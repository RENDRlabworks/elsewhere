import {
  STYLE_ATTRIBUTE_KEYS,
  STYLE_ATTRIBUTE_LABELS,
  type StyleAttributeKey,
  type StyleAttributes,
  type StyleProfile,
  type StyleSnapshot,
  type Swatch,
} from "@/lib/domain/schemas";

export class StyleLockError extends Error {
  constructor(
    message: string,
    public attributes: StyleAttributeKey[] = [],
  ) {
    super(message);
    this.name = "StyleLockError";
  }
}

export type StylePatch = {
  name?: string;
  description?: string;
  attributes?: Partial<StyleAttributes>;
  defaultPalette?: Swatch[];
};

type LockState = Pick<StyleProfile, "locked" | "lockedAttributes">;

export function isAttributeLocked(profile: LockState, key: StyleAttributeKey): boolean {
  return profile.locked || profile.lockedAttributes.includes(key);
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Validate a patch against the profile's locks.
 * A fully locked profile rejects every content change. Individually locked
 * attributes reject changes to their value. Unchanged values are allowed so
 * clients can send whole objects.
 */
export function assertPatchAllowed(profile: StyleProfile, patch: StylePatch): void {
  const changedAttrs = Object.entries(patch.attributes ?? {})
    .filter(([k, v]) => !sameValue(profile.attributes[k as StyleAttributeKey], v))
    .map(([k]) => k as StyleAttributeKey);
  const changesMeta =
    (patch.name !== undefined && patch.name !== profile.name) ||
    (patch.description !== undefined && patch.description !== profile.description) ||
    (patch.defaultPalette !== undefined && !sameValue(patch.defaultPalette, profile.defaultPalette));

  if (profile.locked && (changedAttrs.length || changesMeta)) {
    throw new StyleLockError(`"${profile.name}" is locked. Unlock the profile before editing it.`, changedAttrs);
  }
  const blocked = changedAttrs.filter((k) => profile.lockedAttributes.includes(k));
  if (blocked.length) {
    throw new StyleLockError(
      `Locked attributes cannot be changed: ${blocked.map((k) => STYLE_ATTRIBUTE_LABELS[k]).join(", ")}. Unlock them first.`,
      blocked,
    );
  }
}

/** Apply a patch after validating locks. Returns the next attributes and whether content changed. */
export function applyStylePatch(profile: StyleProfile, patch: StylePatch) {
  assertPatchAllowed(profile, patch);
  const attributes = { ...profile.attributes, ...(patch.attributes ?? {}) };
  const next = {
    name: patch.name ?? profile.name,
    description: patch.description ?? profile.description,
    attributes,
    defaultPalette: patch.defaultPalette ?? profile.defaultPalette,
  };
  const changed = !sameValue(next, snapshotOf(profile));
  return { next, changed };
}

export function snapshotOf(profile: Pick<StyleProfile, "name" | "description" | "attributes" | "defaultPalette">): StyleSnapshot {
  return {
    name: profile.name,
    description: profile.description,
    attributes: structuredClone(profile.attributes),
    defaultPalette: structuredClone(profile.defaultPalette),
  };
}

/**
 * Merge AI-proposed attribute changes, discarding any change to a locked attribute.
 * Returns the merged attributes and the list of keys that were protected.
 */
export function mergeRespectingLocks(profile: StyleProfile, proposed: Partial<StyleAttributes>) {
  const merged: StyleAttributes = { ...profile.attributes };
  const protectedKeys: StyleAttributeKey[] = [];
  for (const key of STYLE_ATTRIBUTE_KEYS) {
    if (!(key in proposed)) continue;
    if (isAttributeLocked(profile, key)) {
      if (!sameValue(proposed[key], profile.attributes[key])) protectedKeys.push(key);
      continue;
    }
    (merged as Record<string, unknown>)[key] = proposed[key];
  }
  return { merged, protectedKeys };
}
