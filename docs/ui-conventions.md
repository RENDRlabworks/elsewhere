# UI conventions

Elsewhere's interface is deliberately quiet so the artwork carries the colour.

## Tokens

Defined in `src/app/globals.css` and exposed as Tailwind colours:

| Token | Use |
| --- | --- |
| `bg-background` (#09090B) | Application background |
| `bg-surface` (#111113) | Panels, cards |
| `bg-elevated` (#19191C) | Popovers, raised elements |
| `bg-interactive` (#222225) | Hover and selected states |
| `border-border` (#29292E) | All borders, 1px |
| `text-foreground` (#EDEDEF) | Primary text |
| `text-text-secondary` (#A1A1AA) | Secondary text |
| `text-text-muted` (#74747D) | Muted text, hints |
| `text-success / warning / danger / info` | Status only, used sparingly |

Radii: 4 to 10px (`rounded-sm` 4, `rounded-md` 6, `rounded-lg` 8). No large rounded cards, no gradients, no glows, no glassmorphism, minimal shadows.

## Type

- Body 13px. Secondary 12 to 12.5px. Hints 11.5px.
- Section headings: `text-[13px] font-medium` or page titles `text-[17px] font-medium`.
- Editorial collection titles: `text-editorial text-[28px]`.
- Metadata labels: `<MetaLabel>` (`.label-meta`: 10.5px uppercase, tracked, muted).
- Technical values and prompts: `font-mono`, usually 11.5 to 12px.

## Components

Use the shadcn primitives in `src/components/ui` and shared pieces in:

- `src/components/common/primitives.tsx`: `PageHeader`, `EmptyState`, `IconButton` (icon + tooltip + shortcut), `Field` (label, optional lock toggle, hint), `LockToggle`, `SwatchStrip`, `Section`, `Stat`, `MetaLabel`.
- `src/components/common/confirm.tsx`: `confirmAction({...})` returns a promise; use it for every destructive operation.
- `src/components/generation/`: `GenerationTile` (thumbnail with status, badges, selection and the right-click menu), `GenerationContextMenu`, actions (`toggleFavorite`, `setReviewStatus`, `deletePermanently`, `downloadGeneration`, `downloadMany`, `useCollectionPicker().show(ids)`).

## Data

- `api<T>(path, { method, body | form })` from `src/lib/client/api.ts`; throws `ApiError` with `message`, `status`, `code`, `details`.
- `useResource<T>(key)` from `src/lib/client/resource.ts` for GETs; `invalidate(prefix)` after mutations.
- `assetSrc(assetId, "thumb" | "full")` builds image URLs. Thumbnails are WebP, 768px.
- App state: `useApp` (bootstrap payload: preferences, profiles, providers, runtime), `usePreferences`, `useProfiles`.
- Toasts: `toast` from `sonner`. Offer Undo where practical.

## Behaviour

- Every visible control performs a real action. No placeholder buttons.
- Empty states are intentional and explain the next step.
- Loading uses `Skeleton`, never fabricated content or progress percentages.
- Rejecting never deletes. Permanent deletion is separate and always confirmed.
- Keyboard: Cmd/Ctrl+K opens the command palette; `g` then a letter navigates. Pages may register command handlers with `onCommand(name, fn)` from `src/stores/ui.ts`.
- Respect reduced motion (handled globally by `MotionConfig` and CSS).
- Copy: plain, specific, and never uses em dashes.
