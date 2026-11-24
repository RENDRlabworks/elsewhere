/**
 * Applies the real Supabase migration to an in-process Postgres (PGlite) with
 * minimal stand-ins for Supabase's `auth` and `storage` schemas, then verifies
 * Row Level Security as the `authenticated` role for two different users.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const SUPABASE_STUBS = `
  create schema if not exists auth;
  create schema if not exists extensions;
  create schema if not exists storage;
  create role authenticated nologin;
  create role anon nologin;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
`;

const GRANTS = `
  grant usage on schema public, storage, extensions, auth to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant execute on all functions in schema auth to authenticated;
`;

let db: PGlite;

async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUBS);
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  await db.exec(GRANTS);
  await db.query("insert into auth.users (id, email) values ($1, 'a@example.com'), ($2, 'b@example.com')", [A, B]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("supabase migration", () => {
  it("enables RLS on every public table", async () => {
    const res = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'",
    );
    expect(res.rows.length).toBeGreaterThanOrEqual(18);
    for (const r of res.rows) expect(r.relrowsecurity, `${r.relname} must have RLS`).toBe(true);
  });

  it("creates a profile when a user signs up", async () => {
    const r = await one<{ n: number }>("select count(*)::int as n from public.profiles");
    expect(r.n).toBe(2);
  });

  it("creates private storage buckets", async () => {
    const res = await db.query<{ id: string; public: boolean }>("select id, public from storage.buckets order by id");
    expect(res.rows).toEqual([
      { id: "generations", public: false },
      { id: "imports", public: false },
      { id: "references", public: false },
    ]);
  });
});

describe("row level security", () => {
  let profileA: string;
  let versionA: string;
  let assetA: string;
  let sceneA: string;
  let genA: string;

  beforeAll(async () => {
    await as(A, async () => {
      profileA = (await one<{ id: string }>("insert into public.style_profiles (name, attributes) values ('Mine', '{}') returning id"))!.id;
      versionA = (await one<{ id: string }>("insert into public.style_profile_versions (profile_id, version, snapshot) values ($1, 1, '{}') returning id", [profileA]))!.id;
      assetA = (await one<{ id: string }>(
        `insert into public.assets (kind, bucket, path, mime_type, width, height, bytes) values ('generation', 'generations', '${A}/x.png', 'image/png', 10, 10, 100) returning id`,
      ))!.id;
      sceneA = (await one<{ id: string }>(
        "insert into public.scenes (subject, composition, palette, output) values ('{}', '{}', '{}', '{}') returning id",
      ))!.id;
      genA = (await one<{ id: string }>(
        "insert into public.generations (kind, source, status, scene_id, asset_id, search_text) values ('generate', 'generated', 'completed', $1, $2, 'a fox in a forest') returning id",
        [sceneA, assetA],
      ))!.id;
    });
  });

  it("lets owners read their own rows", async () => {
    const n = await as(A, () => one<{ n: number }>("select count(*)::int as n from public.generations"));
    expect(n!.n).toBe(1);
  });

  it("hides other users' rows", async () => {
    await as(B, async () => {
      for (const t of ["style_profiles", "style_profile_versions", "assets", "scenes", "generations", "profiles"]) {
        const r = await one<{ n: number }>(`select count(*)::int as n from public.${t} where user_id <> '${B}'`);
        expect(r!.n, t).toBe(0);
      }
    });
  });

  it("prevents updating or deleting other users' rows", async () => {
    await as(B, async () => {
      const upd = await db.query("update public.generations set title = 'stolen' where id = $1", [genA]);
      expect(upd.affectedRows).toBe(0);
      const del = await db.query("delete from public.scenes where id = $1", [sceneA]);
      expect(del.affectedRows).toBe(0);
    });
    const r = await one<{ title: string }>("select title from public.generations where id = $1", [genA]);
    expect(r!.title).toBe("");
  });

  it("prevents inserting rows on behalf of another user", async () => {
    await expect(as(B, () => db.query("insert into public.scenes (user_id, subject, composition, palette, output) values ($1, '{}', '{}', '{}', '{}')", [A]))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("prevents referencing another user's image from your own collection", async () => {
    await as(B, async () => {
      const c = await one<{ id: string }>("insert into public.collections (name) values ('Mine') returning id");
      await expect(db.query("insert into public.collection_items (collection_id, generation_id) values ($1, $2)", [c!.id, genA])).rejects.toThrow(/row-level security/);
    });
  });

  it("prevents attaching another user's asset to your generation", async () => {
    await expect(
      as(B, () => db.query("insert into public.generations (kind, source, status, asset_id) values ('generate', 'generated', 'completed', $1)", [assetA])),
    ).rejects.toThrow(/row-level security/);
  });

  it("keeps ideas private and stops them pointing at another user's photo", async () => {
    await as(A, async () => {
      await db.query("insert into public.ideas (text, asset_id) values ('a fox asleep in a lighthouse lamp', $1)", [assetA]);
    });
    const seen = await as(B, () => one<{ n: number }>("select count(*)::int as n from public.ideas"));
    expect(seen!.n).toBe(0);
    await expect(as(B, () => db.query("insert into public.ideas (text, asset_id) values ('mine now', $1)", [assetA]))).rejects.toThrow(/row-level security/);
    await expect(as(B, () => db.query("insert into public.ideas (text, scene_id) values ('mine now', $1)", [sceneA]))).rejects.toThrow(/row-level security/);
    const upd = await as(B, () => db.query("update public.ideas set status = 'archived'"));
    expect(upd.affectedRows).toBe(0);
  });

  it("keeps Style DNA versions immutable, even for their owner", async () => {
    await as(A, async () => {
      const upd = await db.query("update public.style_profile_versions set snapshot = '{\"changed\":true}' where id = $1", [versionA]);
      expect(upd.affectedRows).toBe(0);
      const del = await db.query("delete from public.style_profile_versions where id = $1", [versionA]);
      expect(del.affectedRows).toBe(0);
    });
  });

  it("enforces one idempotency key per user", async () => {
    await as(A, async () => {
      const q = "insert into public.generation_jobs (status, operation, provider, model, requested_count, idempotency_key) values ('queued', 'generate', 'dev', 'x', 1, 'same-key')";
      await db.query(q);
      await expect(db.query(q)).rejects.toThrow(/duplicate key/);
    });
  });

  it("restricts storage objects to the owner's folder", async () => {
    await as(A, async () => {
      await db.query("insert into storage.objects (bucket_id, name) values ('generations', $1)", [`${A}/image.png`]);
    });
    await expect(as(B, () => db.query("insert into storage.objects (bucket_id, name) values ('generations', $1)", [`${A}/evil.png`]))).rejects.toThrow(
      /row-level security/,
    );
    const seen = await as(B, () => one<{ n: number }>("select count(*)::int as n from storage.objects"));
    expect(seen!.n).toBe(0);
  });

  it("supports substring search on the trigram-indexed search column", async () => {
    const r = await as(A, () => one<{ n: number }>("select count(*)::int as n from public.generations where search_text ilike '%fox%'"));
    expect(r!.n).toBe(1);
  });
});
