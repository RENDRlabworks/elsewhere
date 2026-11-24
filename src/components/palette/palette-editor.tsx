"use client";

import * as React from "react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookmarkPlus, ImageUp, Lock, LockOpen, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { SavedPalette, ScenePalette, Swatch } from "@/lib/domain/schemas";
import { PALETTE_MODE_OPTIONS, type PaletteMode } from "@/lib/domain/vocab";
import { isHex, normalizeHex, readableOn } from "@/lib/palette/color";
import { effectiveSwatches, makeSwatch, paletteToLanguage, regeneratePalette } from "@/lib/palette/engine";
import { extractDominantColors } from "@/lib/palette/extract";
import { describeColor } from "@/lib/palette/names";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate, useResource } from "@/lib/client/resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton, MetaLabel } from "@/components/common/primitives";

type PaletteValue = Pick<ScenePalette, "mode" | "swatches" | "saturation" | "warmth" | "contrast"> & Partial<Pick<ScenePalette, "sourceReferenceId" | "savedPaletteId">>;

/** Read dominant colours from an image file in the browser. */
export async function extractFromFile(file: File, count = 5): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read that image"));
      i.src = url;
    });
    const scale = Math.min(1, 96 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return extractDominantColors(ctx.getImageData(0, 0, canvas.width, canvas.height).data, count);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function SortableSwatch({
  swatch,
  onChange,
  onRemove,
  disabled,
}: {
  swatch: Swatch;
  onChange: (s: Swatch) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: swatch.id, disabled });
  const [draft, setDraft] = React.useState(swatch.hex);
  const [syncedHex, setSyncedHex] = React.useState(swatch.hex);
  if (syncedHex !== swatch.hex) {
    setSyncedHex(swatch.hex);
    setDraft(swatch.hex);
  }
  const commit = (v: string) => {
    if (isHex(v)) onChange({ ...swatch, hex: normalizeHex(v) });
    else setDraft(swatch.hex);
  };
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative flex-1", isDragging && "z-10 opacity-80")}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Swatch ${swatch.hex}${swatch.locked ? ", locked" : ""}. Drag to reorder, click to edit.`}
            className="group relative block h-11 w-full border-r border-black/30 last:border-r-0 focus-visible:z-10 focus-visible:outline-1 focus-visible:outline-foreground"
            style={{ background: swatch.hex }}
          >
            {swatch.locked ? (
              <Lock className="absolute top-1 right-1 size-2.5" style={{ color: readableOn(swatch.hex) }} />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 space-y-3 p-3" align="start">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={swatch.hex}
              disabled={disabled}
              onChange={(e) => onChange({ ...swatch, hex: e.target.value })}
              aria-label="Pick colour"
              className="size-8 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent p-0"
            />
            <Input
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
              className="h-8 font-mono text-[12px]"
              aria-label="Hex value"
            />
          </div>
          <div className="text-[12px] text-text-secondary">{describeColor(swatch.hex)}</div>
          <div className="flex justify-between">
            <Button size="xs" variant="ghost" disabled={disabled} onClick={() => onChange({ ...swatch, locked: !swatch.locked })}>
              {swatch.locked ? <LockOpen /> : <Lock />} {swatch.locked ? "Unlock" : "Lock"}
            </Button>
            <Button size="xs" variant="ghost" disabled={disabled || swatch.locked} onClick={onRemove} className="text-danger">
              <Trash2 /> Remove
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function PaletteEditor({
  value,
  onChange,
  sceneText = "",
  styleHexes,
  references = [],
  disabled,
  showAdjustments = true,
  showModes = true,
  showLanguage = true,
}: {
  value: PaletteValue;
  onChange: (next: PaletteValue) => void;
  sceneText?: string;
  styleHexes?: string[];
  references?: { id: string; label: string; hexes: string[] }[];
  disabled?: boolean;
  showAdjustments?: boolean;
  showModes?: boolean;
  showLanguage?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const { data: saved } = useResource<{ palettes: SavedPalette[] }>("/api/palettes");
  const set = (patch: Partial<PaletteValue>) => onChange({ ...value, ...patch });

  const regenerate = (mode: PaletteMode, refId?: string | null) => {
    const ref = references.find((r) => r.id === (refId ?? value.sourceReferenceId));
    const swatches = regeneratePalette(value.swatches, mode, {
      sceneText,
      styleHexes,
      referenceHexes: ref?.hexes,
      count: Math.max(5, value.swatches.length),
    });
    set({ mode, swatches, sourceReferenceId: mode === "reference" ? (ref?.id ?? null) : (value.sourceReferenceId ?? null) });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = value.swatches.findIndex((s) => s.id === e.active.id);
    const to = value.swatches.findIndex((s) => s.id === e.over!.id);
    set({ swatches: arrayMove(value.swatches, from, to) });
  };

  async function onExtract(file: File) {
    try {
      const hexes = await extractFromFile(file, Math.max(5, value.swatches.length));
      const locked = value.swatches.filter((s) => s.locked);
      set({ mode: "reference", swatches: [...locked, ...hexes.map((h) => makeSwatch(h))].slice(0, 12) });
      toast.success(`Extracted ${hexes.length} colours`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function save() {
    const name = window.prompt("Name this palette", describeColor(value.swatches[Math.floor(value.swatches.length / 2)]?.hex ?? "#333333"));
    if (!name?.trim()) return;
    try {
      await api("/api/palettes", {
        method: "POST",
        body: { name: name.trim(), swatches: value.swatches, mode: value.mode, materials: sceneText ? sceneText.split(/\s+/).slice(0, 6) : [] },
      });
      invalidate("/api/palettes");
      toast.success("Palette saved");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const effective = effectiveSwatches(value);
  const adjusted = value.saturation !== 0 || value.warmth !== 0 || value.contrast !== 0;

  return (
    <div className="space-y-3">
      {showModes ? (
        <div className="flex items-center gap-1.5">
          <Select value={value.mode} disabled={disabled} onValueChange={(m) => regenerate(m as PaletteMode)}>
            <SelectTrigger size="sm" className="h-7 flex-1 text-[12px]" aria-label="Palette mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PALETTE_MODE_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key} disabled={(o.key === "reference" && !references.length) || (o.key === "style" && !styleHexes?.length)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <IconButton icon={RefreshCw} label="Regenerate unlocked colours" disabled={disabled} onClick={() => regenerate(value.mode)} />
          <IconButton icon={ImageUp} label="Extract colours from an image" disabled={disabled} onClick={() => fileRef.current?.click()} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span>
                <IconButton icon={BookmarkPlus} label="Saved palettes" disabled={disabled} />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => void save()} disabled={!value.swatches.length}>
                Save current palette…
              </DropdownMenuItem>
              {saved?.palettes.length ? <DropdownMenuSeparator /> : null}
              {saved?.palettes.length ? <DropdownMenuLabel className="label-meta">Apply saved</DropdownMenuLabel> : null}
              {saved?.palettes.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => set({ swatches: p.swatches.map((s) => makeSwatch(s.hex, false)), mode: "custom", savedPaletteId: p.id })}>
                  <span className="flex h-3 w-12 shrink-0 overflow-hidden rounded-[2px]">
                    {p.swatches.map((s) => (
                      <span key={s.id} className="flex-1" style={{ background: s.hex }} />
                    ))}
                  </span>
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onExtract(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {value.mode === "reference" && references.length ? (
        <Select value={value.sourceReferenceId ?? ""} onValueChange={(id) => regenerate("reference", id)} disabled={disabled}>
          <SelectTrigger size="sm" className="h-7 w-full text-[12px]" aria-label="Reference image for palette">
            <SelectValue placeholder="Choose a reference image" />
          </SelectTrigger>
          <SelectContent>
            {references.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <div className="flex items-stretch gap-1.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.swatches.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-1 overflow-hidden rounded-md border border-border">
              {value.swatches.map((s) => (
                <SortableSwatch
                  key={s.id}
                  swatch={s}
                  disabled={disabled}
                  onChange={(next) => set({ swatches: value.swatches.map((x) => (x.id === s.id ? next : x)), mode: value.mode === "material" ? "custom" : value.mode })}
                  onRemove={() => set({ swatches: value.swatches.filter((x) => x.id !== s.id) })}
                />
              ))}
              {!value.swatches.length ? <div className="flex h-11 flex-1 items-center px-3 text-[12px] text-text-muted">No colours yet</div> : null}
            </div>
          </SortableContext>
        </DndContext>
        <IconButton
          icon={Plus}
          label="Add colour"
          disabled={disabled || value.swatches.length >= 12}
          className="h-auto"
          onClick={() => set({ swatches: [...value.swatches, makeSwatch(value.swatches.at(-1)?.hex ?? "#3c4a42")] })}
        />
      </div>

      {adjusted ? (
        <div className="flex h-1.5 overflow-hidden rounded-full" aria-label="Adjusted palette preview">
          {effective.map((h, i) => (
            <div key={i} className="flex-1" style={{ background: h }} />
          ))}
        </div>
      ) : null}

      {showAdjustments ? (
        <div className="space-y-2.5 pt-1">
          {(
            [
              ["saturation", "Saturation"],
              ["warmth", "Warmth"],
              ["contrast", "Tonal contrast"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="grid grid-cols-[88px_1fr_32px] items-center gap-2">
              <span className="text-[12px] text-text-secondary">{label}</span>
              <Slider
                min={-100}
                max={100}
                step={5}
                value={[value[k]]}
                disabled={disabled}
                onValueChange={([v]) => set({ [k]: v } as Partial<PaletteValue>)}
                aria-label={label}
              />
              <span className="text-right font-mono text-[11px] text-text-muted tabular-nums">{value[k] > 0 ? `+${value[k]}` : value[k]}</span>
            </div>
          ))}
        </div>
      ) : null}

      {showLanguage && value.swatches.length ? (
        <div>
          <MetaLabel className="mb-1">Described to the model as</MetaLabel>
          <p className="text-[11.5px] leading-relaxed text-text-muted">{paletteToLanguage(value).replace(/\s*\(Approximate reference values:.*\)\.?$/, "")}</p>
        </div>
      ) : null}
    </div>
  );
}
