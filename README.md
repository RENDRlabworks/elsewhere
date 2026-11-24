# Elsewhere

**Familiar things. Impossible worlds.**

Elsewhere is a personal creative studio for generating, directing, organising and curating AI-generated fine-art imagery. Art direction is the interface; prompting is the underlying mechanism. You establish a visual identity once (Style DNA), direct scenes through structured controls, and the app assembles a deterministic prompt, generates through a server-side provider, and keeps every image with the exact settings, style snapshot and prompt that produced it.

## What it does

| Destination | Purpose |
| --- | --- |
| **Studio** | Three-panel workspace. Scene direction (subject, world, impossible phenomenon, composition pad with scale language, material palette, references, output), a canvas with zoom, pan, before/after and side-by-side comparison, fullscreen and a filmstrip, and an inspector with the live sectioned prompt, image details with lineage, and quality review. |
| **Explore** | Structured concept generation without generating images. Lock any of the 12 creative variables and randomize the rest, generate five concepts, go further in one direction or a new one. History-aware so it avoids repeating combinations. Optional AI concepts with validated structured output. |
| **Style DNA** | Reusable visual identities with 20 attributes, per-attribute and whole-profile locks, immutable versions, a reference board with roles, and a default palette. Seven presets ship, led by *Elsewhere Volume I*, the house style written from the Volume I originals. Any image can join a reference board without being re-uploaded. |
| **Collections** | Curated series with masonry, grid, editorial, filmstrip and list views, drag-to-reorder, bulk actions, fullscreen presentation and insights (placement heatmap, diversity, repeated patterns, underused compositions). Seeded with *Elsewhere: Volume I* (20 scene records awaiting your original artwork). |
| **Archive** | Every generation with full-text search, filters (status, review, character, environment, model, style, palette, date), bulk actions, scene restoration and an explicit, separate permanent delete. |
| **Settings** | Generation defaults, provider and model, spending safeguards, interface, autosave, shortcuts, usage, storage, integration status and data export. |

Press **Cmd/Ctrl+K** anywhere for the command palette.

## Technology

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui on Radix · Motion · Lucide · Zustand · Zod 4 · Supabase (Postgres, Auth, Storage) · OpenAI Image API and Responses API · Vitest · Playwright · Vercel.

## Architecture

```
src/
  app/
    (app)/            Workspace destinations (client pages inside the app shell)
    api/              Route handlers: the only place secrets and providers are used
    auth/callback     Supabase sign-in completion
    login/            Sign-in (Supabase mode only)
  components/
    ui/               shadcn/ui primitives
    common/           Page header, fields, lock toggles, confirmation
    generation/       Image tiles, context menu, shared image actions
    palette/          Material palette editor
    studio/ explore/ style-dna/ collections/ archive/ settings/
  lib/
    domain/           Zod schemas and controlled vocabularies (single source of truth)
    prompt/           Deterministic prompt assembly and numeric-to-language translation
    style/            Style DNA presets and locking rules
    palette/          Colour math, material palettes, naming, extraction
    explore/          Seeded, lock-aware, history-weighted concept engine
    composition/      Composition analytics and collection insights
    providers/        Image provider registry (OpenAI, development sketch) and text assist
    data/             Repository interface with local JSON and Supabase implementations
    storage/          Private object storage (local disk or Supabase Storage)
    services/         Business logic: bootstrap, styles, generations, collections, assist
    server/           Environment, request context (auth), HTTP helpers
  stores/             Zustand stores (app bootstrap, UI, Studio session)
  proxy.ts            Session refresh and sign-in redirect (Supabase mode)
supabase/migrations/  Database schema, RLS policies and storage buckets
tests/unit|integration|e2e
docs/ui-conventions.md
```

Key decisions:

- **Deterministic prompts.** `src/lib/prompt/assemble.ts` turns scene settings and a Style DNA snapshot into 17 ordered sections. Identical inputs give identical prompts. Numeric controls become language (a 2% subject is "almost imperceptibly small, a mere speck within an overwhelmingly vast environment"). Palettes are described with material colour names, with hex values only as a secondary hint. Every prompt, including manual overrides and custom templates, ends with the standalone-image requirements (no collage, panels, text, watermark or logos).
- **Style is separate from colour and subject.** *Elsewhere Volume I* describes the medium, grain, light and restraint of the originals and leaves hue to each scene. Any finished image or imported original can be used as a style reference ("Use as style reference" on a tile, in the lightbox, the Studio details panel or a multi-selection), and "Recreate in this style" opens the Studio with that image attached as the primary style reference. The prompt tells the model what each reference role carries and that the scene's own subject and palette take precedence over the references. References made this way share the original's stored file, which is only deleted when nothing uses it any more.
- **Start from an image.** The Studio's *Starting image* card sits at the top of the scene panel. Choose up to four of your images (Volume I, favourites or everything), upload or drop a file, and choose whether to take just the look or the look and the scene. Starting images stay attached when you start a new scene or randomize, so a series can keep the same look. Image tiles also have a *Recreate* button on hover.
- **Ideas for every text field.** The dice beside each free-text field fills it with a new idea. With an OpenAI key the ideas are written for the rest of the scene and the Style DNA (`/api/ideas`, fetched six at a time so later clicks are instant); without one they come from the built-in pools in `src/lib/explore/ideas.ts`. Locked fields are left alone, and undo restores the previous text.
- **The scene stays consistent.** Changing a character's kind rewrites every text field that names it (title, description, phenomenon, lighting and the rest), including plurals, possessives and articles, and replaces details that only suited the old subject, such as a human pose or clothing on an animal. A new subject description follows through the scene when you leave the field. It is one undoable step; locked fields are left alone and reported (`src/lib/scene/retarget.ts`).
- **Locks are enforced on the server.** Style DNA locks are checked in `src/lib/style/locking.ts` before any update; AI refinement restores locked sections verbatim; randomization never touches locked scene fields; AI concepts have locks re-applied in code after the model responds.
- **Immutable history.** Each generation stores the submitted prompt, prompt sections, scene snapshot, Style DNA version id and snapshot, reference ids, provider, model, requested and effective output settings, timing, usage and cost. Editing a profile later creates a new version and never alters past images.
- **Honest generation.** Jobs are persisted with real states (queued, generating, processing, completed, failed, cancelled). No fake progress. References are only described in the prompt when they are actually submitted to a model that supports them. Costs are shown from published per-image pricing or computed from reported token usage; otherwise the UI says the cost is recorded after the run.
- **Two storage modes behind one interface.** Supabase in production; a local JSON store and disk storage for development without credentials.

## Local development

Requirements: Node 20.9+ and pnpm 10.

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

Open http://localhost:3000. With no environment variables set, Elsewhere runs in **development mode**:

- Data is stored in `.elsewhere-data/` (JSON database plus image files). No sign-in.
- Image generation uses the **development sketch provider**, which renders a labelled composition study (palette, horizon, subject position and scale). Every sketch says "Development placeholder, not a generated image" in the image, is flagged in the database, and is badged in the UI. It exists to exercise the full workflow; it is never presented as artwork.
- AI concepts, prompt refinement and AI review are disabled with an explanation; the built-in concept engine still works.

The sidebar shows which mode you are in. Add `OPENAI_API_KEY` to `.env.local` to enable live generation while keeping local storage.

## Environment variables

See `.env.example` for the full list.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | For live generation | Server-only. Never sent to the browser, stored in records, or logged (error messages are redacted). |
| `OPENAI_IMAGE_MODEL` | No | Default image model. Defaults to `gpt-image-2.6-flare`. |
| `OPENAI_TEXT_MODEL` | No | Model for concepts, refinement and review. Defaults to `gpt-5.5`. Also settable per user in Settings. |
| `OPENAI_ORG_ID`, `OPENAI_BASE_URL` | No | Organisation and custom endpoint. |
| `NEXT_PUBLIC_SUPABASE_URL` | For production | Supabase project URL, for example `https://<ref>.supabase.co`. Any path after the host (such as `/rest/v1/`) is ignored. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For production | Publishable key (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Safe in the browser; all access is constrained by RLS. |
| `ELSEWHERE_DATA_MODE` | No | Force `local` or `supabase`. |
| `ELSEWHERE_DATA_DIR` | No | Local store directory. Default `.elsewhere-data`. |
| `ELSEWHERE_DEV_PROVIDER` | No | `1` or `0`. Defaults to on in local mode, off with Supabase. |
| `ELSEWHERE_HARD_DAILY_IMAGE_CAP` | No | Server-side ceiling per user per day (default 200), independent of user settings. |

No service-role key is used anywhere. All Supabase access runs with the signed-in user's session.

## Supabase setup

1. Create a project at supabase.com (or run `supabase start` locally with the Supabase CLI).
2. Apply the migration:

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

   ```bash
   supabase db push
   ```

   Or paste `supabase/migrations/20261124000000_initial_schema.sql` into the SQL editor.
3. In **Authentication → URL configuration**, set the site URL and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) as redirect URLs.
4. Enable the Email provider (password and magic link are both supported by the sign-in page).
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

On first sign-in each user's workspace is provisioned automatically: preferences, the seven Style DNA presets with their first versions, and the *Elsewhere: Volume I* collection with its 20 scene records. Provisioning is idempotent and versioned: existing workspaces receive new presets on their next visit, and seeded scenes and untouched defaults move to *Elsewhere Volume I*.

### Database

The migration creates a normalised schema: `profiles`, `user_preferences`, `style_profiles`, `style_profile_versions`, `reference_images`, `assets`, `scenes`, `palettes`, `prompt_templates`, `prompt_versions`, `generation_jobs`, `generations`, `collections`, `collection_items`, `tags`, `taggings`, `image_reviews`, `usage_records`. It includes foreign keys, `updated_at` triggers, a trigram index for archive search, a GIN index for palette filtering, and a unique `(user_id, idempotency_key)` constraint that prevents duplicate submissions.

Row Level Security is enabled on every table. Rows are visible and writable only by their owner; foreign keys to images, scenes, assets and collections must point at the caller's own rows; `style_profile_versions` and `usage_records` are append-only. Add new migrations as new files in `supabase/migrations/` rather than editing tables by hand.

### Storage

Three **private** buckets: `generations`, `references`, `imports`. Objects live under `<user id>/...` and storage policies restrict every operation to the owner's folder. The app serves images through `/api/assets/:id`, which checks ownership and redirects to a short-lived signed URL. Thumbnails (WebP, 768px) are generated with sharp on upload. Nothing is public unless you change these policies yourself.

## Image generation

Providers live in `src/lib/providers/image/` behind one interface (`ImageProvider`): text-to-image, reference-image conditioning, editing (used for variations and refinements), capabilities, sizes, qualities, formats, transparency and pricing metadata. The model registry in `models.ts` reflects the OpenAI image reference as of November 2026 (GPT Image 2.6 Flare and Sunburst, 2.5, 2, 1.5, 1 Mini; `gpt-image-1` was retired in October 2026). Capabilities and prices are configuration, not assumptions in call sites; any model ID can be used and unknown IDs run with conservative, flagged settings.

- Aspect ratio and long edge are mapped to dimensions each model accepts (multiples of 16, 1:3 to 3:1, pixel limits, or the nearest fixed size). Unsupported settings (quality, transparency, format, reference images) are adjusted and explained before you generate.
- Multiple images are requested as separate outputs (`n`), never a grid.
- Variations and refinements send the source image (plus any references) to the edits endpoint.
- Jobs run after the response via Next.js `after()` with `maxDuration = 300`. The client polls job status. Stale jobs are marked failed after 10 minutes so nothing spins forever. Cancel aborts the in-flight request where possible and discards late results.

**Spending safeguards** (Settings → Usage limits): daily image limit, monthly budget, maximum images per request, and a confirmation step above a per-request cost. The server also enforces `ELSEWHERE_HARD_DAILY_IMAGE_CAP`. Idempotency keys and disabled controls prevent double submissions.

To add a provider, implement `ImageProvider`, add its models to a registry file, and list it in `registry.ts`.

## Deployment (Vercel)

1. Create a Supabase project and apply the migration (above).
2. Import the repository in Vercel.
3. Set `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (plus any optional variables) for Production and Preview.
4. Deploy. Add the deployment URL's `/auth/callback` to Supabase redirect URLs.

Generation routes declare `maxDuration = 300`; make sure your plan allows it (Fluid compute is on by default). Local development mode is not suitable for Vercel because its filesystem is ephemeral; the app warns if it detects this.

## Testing

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm test:e2e
```

- **Unit** (`tests/unit`): prompt assembly (determinism, section order, constraints, templates, overrides, reference honesty, locked markers), scale and position language, style locking and lock-safe merges, the exploration engine (determinism, locks, novelty, history weighting, placement diversity), palette engine and extraction, validation schemas, composition analytics.
- **Integration** (`tests/integration`): applies the real Supabase migration to an in-process Postgres (PGlite) and verifies RLS for two users, immutability and storage isolation; runs the generation lifecycle in local mode (bootstrap, completion with stored files and thumbnails, idempotency, variations and lineage, cancellation, reject versus permanent delete, cost confirmation, daily limit, monthly budget, storage safety) and checks that every repository field maps to a migration column.
- **End to end** (`tests/e2e`): Playwright drives the real UI against a production build (`next build && next start`) in local mode with an isolated data directory: bootstrap, directing and generating, live prompt updates, locked randomization, archive search, Style DNA lock enforcement, Explore to Studio and the command palette. To use an already installed Chromium instead of Playwright's download, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path.

CI (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`: typecheck, lint, unit and integration tests in one job, and the Playwright suite in another (Playwright results are uploaded as an artifact on failure). No secrets are required.

Troubleshooting: if `pnpm dev` reloads the page in a loop right after a `pnpm build`, stop the dev server and remove the `.next` directory; the production build and the dev server share it.

## Implementation phases

All three phases are implemented: the creative engine (shell, design system, auth, database, Studio, Style DNA, scene editor, composition, references, palette, prompt engine, real generation, storage); curation (collections, Volume I import, archive, favourites, review, history, prompt versions, comparisons, variations, fullscreen, export); and creative intelligence (AI concepts, randomization, style assessment and drift detection, reference palette extraction, composition analytics, collection insights). Natural next steps: series generation that fills a collection's target count with deliberately varied compositions, and a second image provider using the existing interface.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Cmd/Ctrl+K | Command palette |
| g then s, e, d, c, a, `,` | Go to Studio, Explore, Style DNA, Collections, Archive, Settings |
| Cmd/Ctrl+Enter | Generate |
| Cmd/Ctrl+S | Save scene |
| Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z | Undo, redo scene edits |
| R | Randomize unlocked fields |
| F, A, X | Favorite, accept, reject |
| V | Variation of the selected image |
| [ and ] | Previous and next image |
| 0, 1 | Fit, actual size |
| C | Compare with the parent or previous image |
| I | Toggle inspector |
| Shift+F | Fullscreen |
