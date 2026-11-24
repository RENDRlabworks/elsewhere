import "server-only";
import type { Generation } from "@/lib/domain/schemas";
import type { ServerContext } from "@/lib/server/context";

export function normaliseTags(names: string[]) {
  return [...new Set(names.map((n) => n.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))].slice(0, 30);
}

/** Replace the tags on a target, keeping the normalised tags table and taggings in sync. */
export async function setTags(ctx: ServerContext, targetType: "generation" | "collection", targetId: string, names: string[]) {
  const wanted = normaliseTags(names);
  const tagsTable = ctx.db.table("tags");
  const existing = wanted.length ? await tagsTable.list({ where: { name: { in: wanted } } }) : [];
  const byName = new Map(existing.map((t) => [t.name, t]));
  const missing = wanted.filter((n) => !byName.has(n));
  if (missing.length) {
    for (const t of await tagsTable.insertMany(missing.map((name) => ({ name })))) byName.set(t.name, t);
  }
  await ctx.db.table("taggings").deleteWhere({ targetType, targetId });
  if (wanted.length) {
    await ctx.db.table("taggings").insertMany(wanted.map((n) => ({ tagId: byName.get(n)!.id, targetType, targetId })));
  }
  return wanted;
}

export function buildSearchText(g: Pick<Generation, "title" | "prompt" | "notes" | "tags" | "sceneSnapshot" | "model">) {
  const s = g.sceneSnapshot;
  return [
    g.title,
    s?.description,
    s?.environment,
    s?.phenomenon,
    s?.subject.kind,
    s?.subject.label,
    s?.emotionalTone,
    s?.materials,
    g.notes,
    g.tags.join(" "),
    g.prompt,
    g.model,
  ]
    .filter(Boolean)
    .join(" \n")
    .toLowerCase()
    .slice(0, 20000);
}
