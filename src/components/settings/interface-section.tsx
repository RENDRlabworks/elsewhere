"use client";

import type { Preferences } from "@/lib/domain/schemas";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { NumberField, savePreferences, Segmented, SettingRow, SettingsSection } from "./controls";

type Ui = Preferences["ui"];

const CANVAS: { value: Ui["canvasBackground"]; label: string; swatch: string }[] = [
  { value: "app", label: "App", swatch: "bg-background" },
  { value: "black", label: "Black", swatch: "bg-black" },
  { value: "gray", label: "Gray", swatch: "bg-[#3a3a3e]" },
  { value: "white", label: "White", swatch: "bg-white" },
  { value: "checker", label: "Checker", swatch: "checkerboard bg-[#111113]" },
];

export function InterfaceSection({ prefs }: { prefs: Preferences }) {
  const ui = prefs.ui;
  const save = (patch: Partial<Ui>) => savePreferences({ ui: patch });

  return (
    <SettingsSection id="interface" title="Interface" description="Changes apply immediately and are saved with your workspace.">
      <SettingRow label="Theme" hint="Gallery black is an even quieter canvas for presenting work.">
        <Segmented
          name="set-theme"
          label="Theme"
          value={ui.theme}
          options={[
            { value: "dark", label: "Dark" },
            { value: "black", label: "Gallery black" },
          ]}
          onChange={(theme) => {
            document.documentElement.dataset.theme = theme;
            void save({ theme });
          }}
        />
      </SettingRow>
      <SettingRow label="Gallery density" hint="How tightly images are packed in the Archive and Collections.">
        <Segmented
          name="set-density"
          label="Gallery density"
          value={ui.galleryDensity}
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
            { value: "spacious", label: "Spacious" },
          ]}
          onChange={(galleryDensity) => void save({ galleryDensity })}
        />
      </SettingRow>
      <SettingRow label="Canvas background" hint="The default backdrop behind images in the Studio.">
        <div role="radiogroup" aria-label="Canvas background" className="flex gap-1.5">
          {CANVAS.map((c) => (
            <label
              key={c.value}
              className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-md p-1 has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-text-secondary"
            >
              <input
                type="radio"
                name="set-canvas"
                value={c.value}
                checked={ui.canvasBackground === c.value}
                onChange={() => void save({ canvasBackground: c.value })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block size-8 rounded-md border border-border transition-shadow",
                  c.swatch,
                  ui.canvasBackground === c.value && "ring-1 ring-text-secondary ring-offset-2 ring-offset-background",
                )}
                aria-hidden
              />
              <span className={cn("text-[11px]", ui.canvasBackground === c.value ? "text-foreground" : "text-text-muted")}>{c.label}</span>
            </label>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Reduce motion" hint="Removes transitions and animations throughout Elsewhere." htmlFor="set-motion">
        <Switch
          id="set-motion"
          checked={ui.reduceMotion}
          onCheckedChange={(reduceMotion) => {
            document.documentElement.dataset.reduceMotion = String(reduceMotion);
            void save({ reduceMotion });
          }}
        />
      </SettingRow>
      <SettingRow label="Collapse sidebar" hint="Show navigation as icons only." htmlFor="set-sidebar">
        <Switch
          id="set-sidebar"
          checked={ui.sidebarCollapsed}
          onCheckedChange={(sidebarCollapsed) => {
            useUi.getState().setSidebarCollapsed(sidebarCollapsed);
            void save({ sidebarCollapsed });
          }}
        />
      </SettingRow>
    </SettingsSection>
  );
}

export function AutosaveSection({ prefs }: { prefs: Preferences }) {
  const a = prefs.autosave;
  return (
    <SettingsSection id="autosave" title="Autosave" description="Scenes in the Studio save themselves while you work.">
      <SettingRow label="Autosave scenes" hint="When off, use Save in the Studio to keep changes." htmlFor="set-autosave">
        <Switch id="set-autosave" checked={a.enabled} onCheckedChange={(enabled) => void savePreferences({ autosave: { enabled } })} />
      </SettingRow>
      <SettingRow label="Delay" hint="How long to wait after the last edit before saving. 300 to 10000 ms." htmlFor="set-autosave-delay">
        <NumberField
          id="set-autosave-delay"
          value={a.delayMs}
          min={300}
          max={10000}
          step={100}
          suffix="ms"
          disabled={!a.enabled}
          onCommit={(delayMs) => void savePreferences({ autosave: { delayMs } })}
        />
      </SettingRow>
    </SettingsSection>
  );
}
