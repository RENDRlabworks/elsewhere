"use client";

import * as React from "react";
import type { Preferences, UsageRecord } from "@/lib/domain/schemas";
import { cn, formatDateTime, formatUsd } from "@/lib/utils";
import { MetaLabel, Stat } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberField, savePreferences, Segmented, SettingRow, SettingsSection } from "./controls";

export type UsageSum = { images: number; costUsd: number; estimated: boolean; unknownCost: number };
export type SettingsPayload = {
  preferences: Preferences;
  usage: { today: UsageSum; month: UsageSum; records: UsageRecord[] };
  storage: {
    files: number;
    bytes: number;
    generations: { files: number; bytes: number };
    references: { files: number; bytes: number };
    imports: { files: number; bytes: number };
  };
  runtime: { dataMode: "local" | "supabase"; openaiConfigured: boolean; devProviderEnabled: boolean; ephemeralStorageWarning: boolean };
  hardDailyImageCap: number;
};

function costHint(u: UsageSum) {
  const parts: string[] = [];
  if (u.estimated) parts.push("Includes estimates");
  if (u.unknownCost) parts.push(`${u.unknownCost} record${u.unknownCost === 1 ? "" : "s"} with unknown cost`);
  return parts.join(". ") || undefined;
}

function UsageTable({ records }: { records: UsageRecord[] }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? records : records.slice(0, 10);
  if (!records.length) {
    return <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-muted">No usage recorded this month.</div>;
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-border bg-surface text-text-muted">
              <th scope="col" className="px-3 py-2 font-normal">When</th>
              <th scope="col" className="px-3 py-2 font-normal">Provider and model</th>
              <th scope="col" className="px-3 py-2 font-normal">Kind</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Images</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Tokens</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Cost</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 whitespace-nowrap text-text-secondary">{formatDateTime(r.createdAt)}</td>
                <td className="px-3 py-2">
                  <span className="text-text-secondary">{r.provider === "dev" ? "Development" : r.provider}</span>{" "}
                  <span className="font-mono text-[11px] text-text-muted">{r.model}</span>
                </td>
                <td className="px-3 py-2 text-text-secondary capitalize">{r.kind}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{r.kind === "image" ? r.images : ""}</td>
                <td className="px-3 py-2 text-right font-mono text-text-muted tabular-nums">
                  {r.inputTokens || r.outputTokens ? `${(r.inputTokens + r.outputTokens).toLocaleString()}` : ""}
                </td>
                <td className={cn("px-3 py-2 text-right font-mono tabular-nums", r.costUsd == null && "text-text-muted")}>
                  {r.costUsd == null ? "Unknown" : formatUsd(r.costUsd, r.estimated)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[11.5px] text-text-muted">
        <span>Costs prefixed with ~ are estimates. Development sketches are free.</span>
        {records.length > 10 ? (
          <Button variant="ghost" size="xs" onClick={() => setAll((v) => !v)} className="text-text-secondary">
            {all ? "Show fewer" : `Show all ${records.length}`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function LimitsSection({ prefs, payload }: { prefs: Preferences; payload: SettingsPayload | undefined }) {
  const l = prefs.limits;
  const save = (limits: Partial<Preferences["limits"]>) => savePreferences({ limits });
  const usage = payload?.usage;
  const cap = payload?.hardDailyImageCap;

  return (
    <SettingsSection
      id="limits"
      title="Usage limits and safeguards"
      description="Limits are enforced on the server before any request reaches a provider. Costs are calculated from provider pricing and marked when estimated."
    >
      <div className="grid grid-cols-2 gap-3 border-b border-border py-5 md:grid-cols-4">
        {usage ? (
          <>
            <Stat label="Images today" value={`${usage.today.images} / ${l.dailyImageLimit}`} hint={cap != null ? `Server cap ${cap}` : undefined} />
            <Stat label="Cost today" value={formatUsd(usage.today.costUsd, usage.today.estimated)} hint={costHint(usage.today)} />
            <Stat label="Images this month" value={usage.month.images} />
            <Stat
              label="Cost this month"
              value={formatUsd(usage.month.costUsd, usage.month.estimated)}
              hint={costHint(usage.month) ?? `of ${formatUsd(l.monthlyBudgetUsd)} budget`}
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[66px]" />)
        )}
      </div>

      <SettingRow
        label="Daily image limit"
        hint={`Provider images per day, across all requests. Development sketches do not count.${cap != null ? ` The server also enforces a hard cap of ${cap}; the lower value applies.` : ""}`}
        htmlFor="set-daily"
      >
        <NumberField id="set-daily" value={l.dailyImageLimit} min={0} max={10000} suffix="images" onCommit={(v) => void save({ dailyImageLimit: v })} />
      </SettingRow>
      <SettingRow label="Monthly budget" hint="Requests that would take known spending this month past this amount are blocked. Set to 0 to turn the budget off." htmlFor="set-budget">
        <NumberField id="set-budget" value={l.monthlyBudgetUsd} min={0} max={100000} integer={false} step={1} prefix="$" onCommit={(v) => void save({ monthlyBudgetUsd: v })} />
      </SettingRow>
      <SettingRow label="Images per request" hint="The most images a single generate action may request. Some models allow fewer.">
        <Segmented
          name="set-per-request"
          label="Maximum images per request"
          value={String(l.maxImagesPerRequest) as "1" | "2" | "3" | "4"}
          options={(["1", "2", "3", "4"] as const).map((v) => ({ value: v, label: v }))}
          onChange={(v) => void save({ maxImagesPerRequest: Number(v) })}
        />
      </SettingRow>
      <SettingRow label="Confirm above" hint="Ask for confirmation before any request estimated to cost more than this." htmlFor="set-confirm">
        <NumberField id="set-confirm" value={l.confirmAboveUsd} min={0} max={1000} integer={false} step={0.05} prefix="$" onCommit={(v) => void save({ confirmAboveUsd: v })} />
      </SettingRow>

      <div className="space-y-3 py-5">
        <MetaLabel>Recent usage</MetaLabel>
        {usage ? <UsageTable records={usage.records} /> : <Skeleton className="h-32" />}
      </div>
    </SettingsSection>
  );
}
