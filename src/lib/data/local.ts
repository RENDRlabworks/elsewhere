import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
 * Development-mode persistence: a single JSON document on local disk.
 * Single process, single user. Writes are serialised and atomically renamed.
 * Not suitable for serverless deployments (ephemeral filesystem); use Supabase there.
 */

type Row = Record<string, unknown> & { id: string; userId: string };
type Store = Partial<Record<TableName, Row[]>>;

type LocalState = { file: string; store: Store | null; writing: Promise<void>; dirty: boolean };

const g = globalThis as unknown as { __elsewhereLocal?: Map<string, LocalState> };
g.__elsewhereLocal ??= new Map();

function stateFor(dir: string): LocalState {
  const file = path.resolve(dir, "db.json");
  let s = g.__elsewhereLocal!.get(file);
  if (!s) {
    s = { file, store: null, writing: Promise.resolve(), dirty: false };
    g.__elsewhereLocal!.set(file, s);
  }
  return s;
}

async function load(s: LocalState): Promise<Store> {
  if (s.store) return s.store;
  try {
    const raw = await fs.readFile(s.file, "utf8");
    s.store = JSON.parse(raw) as Store;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    s.store = {};
  }
  return s.store;
}

function persist(s: LocalState): Promise<void> {
  s.dirty = true;
  s.writing = s.writing.then(async () => {
    if (!s.dirty || !s.store) return;
    s.dirty = false;
    await fs.mkdir(path.dirname(s.file), { recursive: true });
    const tmp = `${s.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(s.store));
    await fs.rename(tmp, s.file);
  });
  return s.writing;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function matchesWhere<T>(row: T, where: Where<T> | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where) as [keyof T & string, unknown][]) {
    if (cond === undefined) continue;
    const value = (row as Record<string, unknown>)[key];
    if (isOperator(cond)) {
      const [op, arg] = Object.entries(cond)[0];
      switch (op) {
        case "in":
          if (!(arg as unknown[]).includes(value)) return false;
          break;
        case "neq":
          if (value === arg) return false;
          break;
        case "gte":
          if (value == null || compare(value, arg) < 0) return false;
          break;
        case "lte":
          if (value == null || compare(value, arg) > 0) return false;
          break;
        case "isNull":
          if (value != null) return false;
          break;
        case "notNull":
          if (value == null) return false;
          break;
        case "contains":
          if (!Array.isArray(value) || !value.includes(arg)) return false;
          break;
      }
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

export function matchesSearch(row: unknown, search: ListOptions<unknown>["search"]): boolean {
  if (!search || !search.query.trim()) return true;
  const hay = String((row as Record<string, unknown>)[search.field] ?? "").toLowerCase();
  return search.query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export function applyListOptions<T>(rows: T[], opts: ListOptions<T> = {}): T[] {
  let out = rows.filter(
    (r) => matchesWhere(r, opts.where) && matchesSearch(r, opts.search as ListOptions<unknown>["search"]),
  );
  if (opts.order?.length) {
    out = [...out].sort((a, b) => {
      for (const o of opts.order!) {
        const c = compare((a as Record<string, unknown>)[o.field], (b as Record<string, unknown>)[o.field]);
        if (c !== 0) return o.ascending === false ? -c : c;
      }
      return 0;
    });
  }
  const offset = opts.offset ?? 0;
  if (offset || opts.limit != null) out = out.slice(offset, opts.limit != null ? offset + opts.limit : undefined);
  return out;
}

class LocalTable<T extends { id: string }> implements Table<T> {
  constructor(
    private s: LocalState,
    private name: TableName,
    private userId: string,
  ) {}

  private async rows(): Promise<Row[]> {
    const store = await load(this.s);
    store[this.name] ??= [];
    return store[this.name]!;
  }

  private async mine(): Promise<T[]> {
    return (await this.rows()).filter((r) => r.userId === this.userId) as unknown as T[];
  }

  async list(opts?: ListOptions<T>) {
    return structuredClone(applyListOptions(await this.mine(), opts));
  }

  async count(opts?: Pick<ListOptions<T>, "where" | "search">) {
    return applyListOptions(await this.mine(), opts).length;
  }

  async get(id: string) {
    const r = (await this.mine()).find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }

  async first(opts: ListOptions<T>) {
    return (await this.list({ ...opts, limit: 1 }))[0] ?? null;
  }

  private build(row: InsertRow<T>): Row {
    const now = new Date().toISOString();
    const r = {
      id: randomUUID(),
      createdAt: now,
      ...(TABLES_WITH_UPDATED_AT.has(this.name) ? { updatedAt: now } : {}),
      ...structuredClone(row as Record<string, unknown>),
      userId: this.userId,
    } as Row;
    return r;
  }

  async insert(row: InsertRow<T>) {
    return (await this.insertMany([row]))[0];
  }

  async insertMany(rows: InsertRow<T>[]) {
    const all = await this.rows();
    const built = rows.map((r) => this.build(r));
    for (const b of built) {
      if (all.some((x) => x.id === b.id)) throw new Error(`Duplicate id in ${this.name}`);
    }
    all.push(...built);
    await persist(this.s);
    return structuredClone(built) as unknown as T[];
  }

  async update(id: string, patch: Partial<T>) {
    const all = await this.rows();
    const r = all.find((x) => x.id === id && x.userId === this.userId);
    if (!r) throw new NotFoundError(this.name);
    Object.assign(r, structuredClone(patch), { id: r.id, userId: r.userId });
    if (TABLES_WITH_UPDATED_AT.has(this.name) && !("updatedAt" in (patch as object))) {
      r.updatedAt = new Date().toISOString();
    }
    await persist(this.s);
    return structuredClone(r) as unknown as T;
  }

  async updateWhere(where: Where<T>, patch: Partial<T>) {
    const targets = (await this.mine()).filter((r) => matchesWhere(r, where));
    for (const t of targets) await this.update(t.id, patch);
    return targets.length;
  }

  async delete(id: string) {
    const all = await this.rows();
    const idx = all.findIndex((x) => x.id === id && x.userId === this.userId);
    if (idx >= 0) {
      all.splice(idx, 1);
      await persist(this.s);
    }
  }

  async deleteWhere(where: Where<T>) {
    const all = await this.rows();
    const before = all.length;
    const keep = all.filter((r) => !(r.userId === this.userId && matchesWhere(r as unknown as T, where)));
    (await load(this.s))[this.name] = keep;
    if (keep.length !== before) await persist(this.s);
    return before - keep.length;
  }
}

export function createLocalDatabase(userId: string, dir: string): Database {
  const s = stateFor(dir);
  return {
    userId,
    table<N extends TableName>(name: N) {
      return new LocalTable<Tables[N]>(s, name, userId);
    },
  };
}

/** Test helper: drop cached state so a fresh directory can be used. */
export function resetLocalCache() {
  g.__elsewhereLocal!.clear();
}
