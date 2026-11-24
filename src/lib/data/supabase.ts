import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/server/http";
import {
  isOperator,
  NotFoundError,
  TABLES_WITH_UPDATED_AT,
  type Database,
  type InsertRow,
  type ListOptions,
  type Table,
  type TableName,
  type Tables,
  type Where,
} from "./types";

/**
 * Production persistence on Supabase Postgres.
 * Every query runs with the signed-in user's JWT, so Row Level Security is the
 * primary authorisation boundary. Queries also filter on user_id explicitly as
 * defence in depth.
 */

export const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export function rowToDb(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== undefined) out[toSnake(k)] = v;
  return out;
}

export function rowFromDb<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

/**
 * PostgREST builder generics are too deep for generic helpers, so filters are
 * applied through this minimal structural interface.
 */
type Filterable = {
  eq(col: string, v: unknown): Filterable;
  in(col: string, v: unknown[]): Filterable;
  neq(col: string, v: unknown): Filterable;
  gte(col: string, v: unknown): Filterable;
  lte(col: string, v: unknown): Filterable;
  is(col: string, v: null): Filterable;
  not(col: string, op: string, v: unknown): Filterable;
  contains(col: string, v: unknown[]): Filterable;
  ilike(col: string, v: string): Filterable;
};

function applyWhere<Q>(query: Q, where: Where<unknown> | undefined): Q {
  let q = query as unknown as Filterable;
  if (!where) return query;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const col = toSnake(key);
    if (isOperator(cond)) {
      const [op, arg] = Object.entries(cond)[0];
      switch (op) {
        case "in":
          q = q.in(col, arg as unknown[]);
          break;
        case "neq":
          q = q.neq(col, arg);
          break;
        case "gte":
          q = q.gte(col, arg);
          break;
        case "lte":
          q = q.lte(col, arg);
          break;
        case "isNull":
          q = q.is(col, null);
          break;
        case "notNull":
          q = q.not(col, "is", null);
          break;
        case "contains":
          q = q.contains(col, [arg]);
          break;
      }
    } else if (cond === null) {
      q = q.is(col, null);
    } else {
      q = q.eq(col, cond);
    }
  }
  return q as unknown as Q;
}

function applySearch<Q>(query: Q, search: ListOptions<unknown>["search"]): Q {
  if (!search?.query.trim()) return query;
  let q = query as unknown as Filterable;
  const col = toSnake(search.field);
  for (const word of search.query.split(/\s+/).filter(Boolean)) {
    const escaped = word.replace(/[%_\\]/g, (c) => `\\${c}`);
    q = q.ilike(col, `%${escaped}%`);
  }
  return q as unknown as Q;
}

export const DATABASE_NOT_READY_MESSAGE =
  "The database isn't set up yet. Run supabase/migrations/20261124000000_initial_schema.sql in the Supabase SQL editor, then retry.";

/** True when PostgREST or Postgres reports that a table does not exist, i.e. the migration has not run. */
export function isMissingTableError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table .* in the schema cache|relation .* does not exist/i.test(error.message ?? "")
  );
}

function fail(table: string, error: { message: string; code?: string } | null): never {
  if (isMissingTableError(error)) throw new HttpError(503, DATABASE_NOT_READY_MESSAGE, "database_not_ready");
  throw new Error(`[${table}] ${error?.message ?? "Unknown database error"}`);
}

class SupabaseTable<T extends { id: string }> implements Table<T> {
  constructor(
    private client: SupabaseClient,
    private name: TableName,
    private userId: string,
  ) {}

  private base(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    return this.client.from(this.name).select(columns, opts).eq("user_id", this.userId);
  }

  async list(opts: ListOptions<T> = {}) {
    const cols = opts.select?.length ? opts.select.map(toSnake).join(",") : "*";
    let q = applySearch(applyWhere(this.base(cols), opts.where as Where<unknown>), opts.search as never);
    for (const o of opts.order ?? []) q = q.order(toSnake(o.field), { ascending: o.ascending !== false });
    if (opts.limit != null) {
      const from = opts.offset ?? 0;
      q = q.range(from, from + opts.limit - 1);
    }
    const { data, error } = await q;
    if (error) fail(this.name, error);
    return (data ?? []).map((r) => rowFromDb<T>(r as unknown as Record<string, unknown>));
  }

  async count(opts: Pick<ListOptions<T>, "where" | "search"> = {}) {
    const q = applySearch(
      applyWhere(this.base("id", { count: "exact", head: true }), opts.where as Where<unknown>),
      opts.search as never,
    );
    const { count, error } = await q;
    if (error) fail(this.name, error);
    return count ?? 0;
  }

  async get(id: string) {
    const { data, error } = await this.base().eq("id", id).maybeSingle();
    if (error) fail(this.name, error);
    return data ? rowFromDb<T>(data as unknown as Record<string, unknown>) : null;
  }

  async first(opts: ListOptions<T>) {
    return (await this.list({ ...opts, limit: 1 }))[0] ?? null;
  }

  async insert(row: InsertRow<T>) {
    return (await this.insertMany([row]))[0];
  }

  async insertMany(rows: InsertRow<T>[]) {
    if (!rows.length) return [];
    const now = new Date().toISOString();
    const payload = rows.map((r) =>
      rowToDb({
        createdAt: now,
        ...(TABLES_WITH_UPDATED_AT.has(this.name) ? { updatedAt: now } : {}),
        ...(r as Record<string, unknown>),
        userId: this.userId,
      }),
    );
    const { data, error } = await this.client.from(this.name).insert(payload).select("*");
    if (error) fail(this.name, error);
    return (data ?? []).map((r) => rowFromDb<T>(r as Record<string, unknown>));
  }

  async update(id: string, patch: Partial<T>) {
    const body = rowToDb({
      ...(TABLES_WITH_UPDATED_AT.has(this.name) ? { updatedAt: new Date().toISOString() } : {}),
      ...(patch as Record<string, unknown>),
    });
    delete body.id;
    delete body.user_id;
    const { data, error } = await this.client
      .from(this.name)
      .update(body)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("*")
      .maybeSingle();
    if (error) fail(this.name, error);
    if (!data) throw new NotFoundError(this.name);
    return rowFromDb<T>(data as Record<string, unknown>);
  }

  async updateWhere(where: Where<T>, patch: Partial<T>) {
    const body = rowToDb({
      ...(TABLES_WITH_UPDATED_AT.has(this.name) ? { updatedAt: new Date().toISOString() } : {}),
      ...(patch as Record<string, unknown>),
    });
    delete body.id;
    delete body.user_id;
    const q = applyWhere(this.client.from(this.name).update(body).eq("user_id", this.userId), where as Where<unknown>);
    const { data, error } = await q.select("id");
    if (error) fail(this.name, error);
    return data?.length ?? 0;
  }

  async delete(id: string) {
    const { error } = await this.client.from(this.name).delete().eq("id", id).eq("user_id", this.userId);
    if (error) fail(this.name, error);
  }

  async deleteWhere(where: Where<T>) {
    const q = applyWhere(this.client.from(this.name).delete().eq("user_id", this.userId), where as Where<unknown>);
    const { data, error } = await q.select("id");
    if (error) fail(this.name, error);
    return data?.length ?? 0;
  }
}

export function createSupabaseDatabase(client: SupabaseClient, userId: string): Database {
  return {
    userId,
    table<N extends TableName>(name: N) {
      return new SupabaseTable<Tables[N]>(client, name, userId);
    },
  };
}
