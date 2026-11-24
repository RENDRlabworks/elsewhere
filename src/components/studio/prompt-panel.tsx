"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, ClipboardCopy, Download, History, Lock, Pencil, RotateCcw, Save, Wand2 } from "lucide-react";
import type { PromptSection, PromptVersion } from "@/lib/domain/schemas";
import { api, errorMessage } from "@/lib/client/api";
import { invalidate, useResource } from "@/lib/client/resource";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton, MetaLabel } from "@/components/common/primitives";
import { useApp } from "@/stores/app";
import { useStudio } from "@/stores/studio";
import { DEFAULT_TEMPLATE } from "@/lib/prompt/assemble";
import type { StudioSession } from "./use-studio-session";

type Refinement = { text: string; sections: PromptSection[]; original: string; rationale: string; protectedSections: string[]; model: string };

export function PromptPanel({ session }: { session: StudioSession }) {
  const scene = useStudio((s) => s.scene);
  const sceneId = useStudio((s) => s.sceneId);
  const update = useStudio((s) => s.update);
  const textAssist = useApp((s) => s.data?.textAssist);
  const { prompt } = session;
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [refineOpen, setRefineOpen] = React.useState(false);
  const isManual = prompt.isManual;

  const startEdit = () => {
    setDraft(scene.promptOverride ?? prompt.assembled);
    setEditing(true);
  };
  const commitEdit = async () => {
    const text = draft.trim();
    update({ promptOverride: text && text !== prompt.assembled ? text : null });
    setEditing(false);
    if (sceneId && text) {
      await api(`/api/scenes/${sceneId}/prompt-versions`, { body: { text, isManual: true, source: "manual" } }).catch(() => {});
      invalidate(`/api/scenes/${sceneId}/prompt-versions`);
    }
  };
  const resetOverride = () => {
    update({ promptOverride: null });
    toast("Manual edits cleared. The prompt follows the scene again.", { action: { label: "Undo", onClick: () => useStudio.getState().undo() } });
  };
  const exportPrompt = () => {
    const blob = new Blob([prompt.text], { type: "text/plain" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${(scene.title || "prompt").replace(/[^\w-]+/g, "-").toLowerCase()}.txt` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const toggle = (k: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const allCollapsed = collapsed.size >= prompt.sections.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase", isManual ? "bg-warning/10 text-warning" : "text-text-muted")}>
            {isManual ? "Manual" : "Assembled"}
          </span>
          <span className="font-mono text-[10.5px] text-text-muted tabular-nums">{prompt.text.length.toLocaleString()} chars</span>
        </div>
        <div className="flex items-center">
          <IconButton icon={allCollapsed ? ChevronsUpDown : ChevronsDownUp} label={allCollapsed ? "Expand all" : "Collapse all"} size="icon-xs" disabled={isManual || editing} onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(prompt.sections.map((s) => s.key)))} />
          <IconButton icon={ClipboardCopy} label="Copy prompt" size="icon-xs" onClick={() => void session.copyPrompt()} />
          <IconButton icon={Pencil} label="Edit manually" size="icon-xs" active={editing} onClick={editing ? () => void commitEdit() : startEdit} />
          {isManual ? <IconButton icon={RotateCcw} label="Reset manual edits" size="icon-xs" onClick={resetOverride} /> : null}
          <IconButton icon={History} label="Version history" size="icon-xs" disabled={!sceneId} onClick={() => setHistoryOpen(true)} />
          <IconButton icon={Save} label="Save as template" size="icon-xs" onClick={() => setTemplateOpen(true)} />
          <IconButton icon={Download} label="Export prompt" size="icon-xs" onClick={exportPrompt} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {editing ? (
          <div className="space-y-2 p-3">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[360px] resize-none font-mono text-[11.5px] leading-relaxed"
              aria-label="Manual prompt"
            />
            <p className="text-[11px] text-text-muted">Output requirements (single standalone image, no text, no watermark) are appended automatically if removed.</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void commitEdit()}>
                Use this prompt
              </Button>
            </div>
          </div>
        ) : isManual ? (
          <div className="p-3">
            <pre className="font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-text-secondary">{prompt.text}</pre>
            <p className="mt-3 border-t border-border pt-2 text-[11px] text-text-muted">
              Manual prompt in use. Scene controls no longer change it until you reset.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-border/60">
            {prompt.sections.map((s, i) => (
              <li key={s.key}>
                <button type="button" onClick={() => toggle(s.key)} className="flex w-full items-center gap-2 px-3 pt-2.5 pb-1 text-left" aria-expanded={!collapsed.has(s.key)}>
                  <span className="w-5 font-mono text-[10px] text-text-muted/70 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="label-meta flex-1">{s.label}</span>
                  {s.locked ? <Lock className="size-2.5 text-warning" aria-label="Locked" /> : null}
                  <ChevronDown className={cn("size-3 text-text-muted transition-transform", collapsed.has(s.key) && "-rotate-90")} />
                </button>
                {!collapsed.has(s.key) ? <p className="px-3 pb-2.5 pl-10 font-mono text-[11.5px] leading-relaxed text-text-secondary">{s.text}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={!textAssist?.available}
          onClick={() => setRefineOpen(true)}
          title={textAssist?.available ? undefined : "Requires OPENAI_API_KEY on the server"}
        >
          <Wand2 /> Refine with AI
        </Button>
        {!textAssist?.available ? <p className="mt-1.5 text-center text-[11px] text-text-muted">AI refinement needs an OpenAI key.</p> : null}
      </div>

      <VersionHistory open={historyOpen} onOpenChange={setHistoryOpen} sceneId={sceneId} onRestore={(text) => update({ promptOverride: text })} current={prompt.text} />
      <SaveTemplate open={templateOpen} onOpenChange={setTemplateOpen} />
      <RefineDialog open={refineOpen} onOpenChange={setRefineOpen} />
    </div>
  );
}

function VersionHistory({
  open,
  onOpenChange,
  sceneId,
  onRestore,
  current,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sceneId: string | null;
  onRestore: (text: string) => void;
  current: string;
}) {
  const { data } = useResource<{ versions: PromptVersion[] }>(open && sceneId ? `/api/scenes/${sceneId}/prompt-versions` : null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = data?.versions.find((v) => v.id === selectedId) ?? data?.versions[0] ?? null;
  const setSelected = (v: PromptVersion) => setSelectedId(v.id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium">Prompt history</DialogTitle>
          <DialogDescription className="text-[12.5px]">Every prompt submitted for this scene, plus manual and refined versions.</DialogDescription>
        </DialogHeader>
        <div className="grid h-[420px] grid-cols-[200px_1fr] gap-3">
          <div className="space-y-0.5 overflow-y-auto">
            {(data?.versions ?? []).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelected(v)}
                className={cn("w-full rounded-sm px-2 py-1.5 text-left", selected?.id === v.id ? "bg-interactive" : "hover:bg-surface")}
              >
                <div className="text-[12px] text-foreground">{formatDateTime(v.createdAt)}</div>
                <div className="text-[11px] text-text-muted capitalize">
                  {v.source}
                  {v.text === current ? " · current" : ""}
                </div>
              </button>
            ))}
            {data && !data.versions.length ? <div className="p-2 text-[12px] text-text-muted">No versions yet. Generate or edit the prompt to start a history.</div> : null}
          </div>
          <pre className="overflow-y-auto rounded-md border border-border bg-surface p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-text-secondary">{selected?.text ?? ""}</pre>
        </div>
        <DialogFooter>
          <Button
            size="sm"
            disabled={!selected || selected.text === current}
            onClick={() => {
              if (!selected) return;
              onRestore(selected.text);
              onOpenChange(false);
              toast.success("Restored as a manual prompt");
            }}
          >
            Restore this version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplate({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState(DEFAULT_TEMPLATE);
  const update = useStudio((s) => s.update);
  const save = async () => {
    try {
      const { template } = await api<{ template: { id: string } }>("/api/prompt-templates", { body: { name: name.trim(), body } });
      invalidate("/api/prompt-templates");
      update({ promptTemplateId: template.id });
      toast.success("Template saved and applied to this scene");
      onOpenChange(false);
      setName("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium">Save prompt template</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Templates control the order of sections and can add fixed wording. Use tokens like {"{{concept}}"}, {"{{palette}}"} or {"{{style}}"}. Output requirements are always included.
          </DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" aria-label="Template name" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-mono text-[11.5px]" aria-label="Template body" />
        <DialogFooter>
          <Button size="sm" disabled={!name.trim() || !body.trim()} onClick={() => void save()}>
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const scene = useStudio((s) => s.scene);
  const sceneId = useStudio((s) => s.sceneId);
  const update = useStudio((s) => s.update);
  const [direction, setDirection] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Refinement | null>(null);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setResult(null);
  }
  const run = async () => {
    setBusy(true);
    try {
      setResult(await api<Refinement>("/api/prompt/refine", { body: { scene, direction } }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!result) return;
    update({ promptOverride: result.text });
    if (sceneId) await api(`/api/scenes/${sceneId}/prompt-versions`, { body: { text: result.text, isManual: true, source: "refined" } }).catch(() => {});
    toast.success("Refined prompt applied", { action: { label: "Undo", onClick: () => useStudio.getState().undo() } });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium">Refine prompt with AI</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Proposes clearer wording. Locked look attributes and locked scene fields are restored verbatim. Nothing changes until you apply it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Optional direction, for example: more tactile materials" onKeyDown={(e) => e.key === "Enter" && void run()} />
          <Button size="sm" variant="secondary" onClick={() => void run()} disabled={busy}>
            {busy ? "Refining…" : "Propose"}
          </Button>
        </div>
        {result ? (
          <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-hidden">
            <div className="flex min-h-0 flex-col">
              <MetaLabel className="mb-1">Current</MetaLabel>
              <pre className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-text-muted">{result.original}</pre>
            </div>
            <div className="flex min-h-0 flex-col">
              <MetaLabel className="mb-1">Proposed</MetaLabel>
              <pre className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-text-secondary">{result.text}</pre>
            </div>
            <div className="col-span-2 space-y-1 text-[12px] text-text-secondary">
              <p>{result.rationale}</p>
              {result.protectedSections.length ? (
                <p className="text-warning">Ignored changes to locked sections: {result.protectedSections.join(", ")}.</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button size="sm" disabled={!result} onClick={() => void apply()}>
            Apply as manual prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
