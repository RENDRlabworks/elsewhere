import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKETS = {
  generations: "generations",
  references: "references",
  imports: "imports",
} as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

export interface ObjectStorage {
  put(bucket: Bucket, objectPath: string, data: Buffer, contentType: string): Promise<void>;
  get(bucket: Bucket, objectPath: string): Promise<Buffer | null>;
  remove(bucket: Bucket, objectPaths: string[]): Promise<void>;
  /** A short-lived URL for direct download, or null when files must be streamed through the app. */
  signedUrl(bucket: Bucket, objectPath: string, expiresInSeconds?: number): Promise<string | null>;
}

function safeJoin(root: string, ...parts: string[]) {
  const p = path.resolve(root, ...parts);
  if (!p.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid storage path");
  return p;
}

export function createLocalStorage(dataDir: string): ObjectStorage {
  const root = path.resolve(dataDir, "storage");
  return {
    async put(bucket, objectPath, data) {
      const file = safeJoin(root, bucket, objectPath);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, data);
    },
    async get(bucket, objectPath) {
      try {
        return await fs.readFile(safeJoin(root, bucket, objectPath));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async remove(bucket, objectPaths) {
      await Promise.all(objectPaths.map((p) => fs.rm(safeJoin(root, bucket, p), { force: true })));
    },
    async signedUrl() {
      return null;
    },
  };
}

export function createSupabaseStorage(client: SupabaseClient): ObjectStorage {
  return {
    async put(bucket, objectPath, data, contentType) {
      const { error } = await client.storage.from(bucket).upload(objectPath, data, { contentType, upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    },
    async get(bucket, objectPath) {
      const { data, error } = await client.storage.from(bucket).download(objectPath);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },
    async remove(bucket, objectPaths) {
      if (!objectPaths.length) return;
      const { error } = await client.storage.from(bucket).remove(objectPaths);
      if (error) throw new Error(`Storage delete failed: ${error.message}`);
    },
    async signedUrl(bucket, objectPath, expiresInSeconds = 300) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(objectPath, expiresInSeconds);
      if (error || !data) return null;
      return data.signedUrl;
    },
  };
}
