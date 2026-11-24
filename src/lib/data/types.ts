import type {
  Asset,
  Collection,
  CollectionItem,
  Generation,
  GenerationJob,
  Idea,
  ImageReview,
  PromptTemplate,
  PromptVersion,
  ReferenceImage,
  SavedPalette,
  Scene,
  StyleProfile,
  StyleProfileVersion,
  Tag,
  Tagging,
  UsageRecord,
  UserPreferences,
} from "@/lib/domain/schemas";

export type Profile = { id: string; userId: string; displayName: string; createdAt: string; updatedAt: string };

/** Map of table name to row type. Rows are camelCase in TypeScript and snake_case in Postgres. */
export type Tables = {
  profiles: Profile;
  user_preferences: UserPreferences;
  style_profiles: StyleProfile;
  style_profile_versions: StyleProfileVersion;
  reference_images: ReferenceImage;
  assets: Asset;
  scenes: Scene;
  palettes: SavedPalette;
  prompt_templates: PromptTemplate;
  prompt_versions: PromptVersion;
  generations: Generation;
  generation_jobs: GenerationJob;
  collections: Collection;
  collection_items: CollectionItem;
  tags: Tag;
  taggings: Tagging;
  image_reviews: ImageReview;
  usage_records: UsageRecord;
  ideas: Idea;
};
export type TableName = keyof Tables;

/** Tables whose rows carry an `updatedAt` column maintained by the repository. */
export const TABLES_WITH_UPDATED_AT: ReadonlySet<TableName> = new Set<TableName>([
  "profiles",
  "user_preferences",
  "style_profiles",
  "reference_images",
  "scenes",
  "palettes",
  "prompt_templates",
  "generations",
  "generation_jobs",
  "collections",
  "ideas",
]);

export type Condition<V> =
  | V
  | { in: V[] }
  | { neq: V }
  | { gte: V }
  | { lte: V }
  | { isNull: true }
  | { notNull: true }
  | { contains: V extends (infer E)[] ? E : never };

export type Where<T> = { [K in keyof T]?: Condition<T[K]> };

export type ListOptions<T> = {
  where?: Where<T>;
  order?: { field: keyof T & string; ascending?: boolean }[];
  limit?: number;
  offset?: number;
  /** Case-insensitive substring match: every word must appear in `field`. */
  search?: { field: keyof T & string; query: string };
  /** Restrict to a subset of columns (performance hint, ignored by local store). */
  select?: (keyof T & string)[];
};

export type InsertRow<T> = Omit<T, "id" | "userId" | "createdAt" | "updatedAt"> &
  Partial<Pick<T & { id: string; createdAt: string; updatedAt: string }, "id" | "createdAt" | "updatedAt">>;

export interface Table<T extends { id: string }> {
  list(opts?: ListOptions<T>): Promise<T[]>;
  count(opts?: Pick<ListOptions<T>, "where" | "search">): Promise<number>;
  get(id: string): Promise<T | null>;
  first(opts: ListOptions<T>): Promise<T | null>;
  insert(row: InsertRow<T>): Promise<T>;
  insertMany(rows: InsertRow<T>[]): Promise<T[]>;
  update(id: string, patch: Partial<T>): Promise<T>;
  updateWhere(where: Where<T>, patch: Partial<T>): Promise<number>;
  delete(id: string): Promise<void>;
  deleteWhere(where: Where<T>): Promise<number>;
}

export interface Database {
  readonly userId: string;
  table<N extends TableName>(name: N): Table<Tables[N]>;
}

export const OPERATOR_KEYS = new Set(["in", "neq", "gte", "lte", "isNull", "notNull", "contains"]);

export function isOperator(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length === 1 && OPERATOR_KEYS.has(keys[0]);
}

export class NotFoundError extends Error {
  constructor(what = "Record") {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}
