import type {
  PromptSection,
  SceneContent,
  StyleAttributeKey,
  StyleSnapshot,
} from "@/lib/domain/schemas";
import type { ReferenceRole } from "@/lib/domain/vocab";
import { REFERENCE_ROLE_OPTIONS } from "@/lib/domain/vocab";
import { paletteToLanguage } from "@/lib/palette/engine";
import { sentence } from "@/lib/utils";
import {
  capitalize,
  characterLanguage,
  compositionLanguage,
  scaleLanguage,
  timeOfDayLanguage,
} from "./language";

/**
 * Deterministic, modular prompt assembly.
 * Identical inputs always produce an identical prompt. Nothing here calls a model.
 */

export const SECTION_ORDER = [
  ["concept", "Scene concept"],
  ["environment", "Environment"],
  ["character", "Character"],
  ["action", "Character action"],
  ["phenomenon", "Impossible phenomenon"],
  ["scale", "Scale"],
  ["composition", "Composition"],
  ["materials", "Materials"],
  ["lighting", "Lighting"],
  ["palette", "Color palette"],
  ["texture", "Texture"],
  ["atmosphere", "Atmosphere"],
  ["emotion", "Emotional tone"],
  ["style", "Style DNA"],
  ["references", "References"],
  ["constraints", "Constraints"],
  ["output", "Output requirements"],
] as const;
export type SectionKey = (typeof SECTION_ORDER)[number][0];

export const OUTPUT_REQUIREMENTS =
  "Output: one single standalone photograph filling the entire frame. No collage, no multiple panels, no split frames or grids, no embedded text or typography, no watermark, no logos, no borders, and no unnecessary elements.";

const REQUIRED_PHRASES = ["no collage", "no multiple panels", "no embedded text", "no watermark", "no logos"];

export type AssembleReference = { role: ReferenceRole; label: string };

export type AssembleInput = {
  scene: SceneContent;
  style: StyleSnapshot | null;
  lockedStyleKeys?: StyleAttributeKey[];
  styleLocked?: boolean;
  /** References actually being submitted to the provider. Never describe references that are not sent. */
  references?: AssembleReference[];
  template?: string | null;
  operation?: "generate" | "variation" | "refine";
  instruction?: string;
};

export type AssembledPrompt = {
  sections: PromptSection[];
  /** The assembled prompt (template applied), ignoring any manual override. */
  assembled: string;
  /** The prompt that would be submitted: the manual override if present, else `assembled`. */
  text: string;
  isManual: boolean;
};

function join(...parts: (string | undefined | null | false)[]) {
  return parts
    .map((p) => (p ? String(p).trim() : ""))
    .filter(Boolean)
    .map(sentence)
    .join(" ");
}

function orientationWord(aspect: string) {
  const [w, h] = aspect.split(":").map(Number);
  if (w === h) return "square";
  return w > h ? "landscape" : "portrait";
}

function listWithAnd(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function buildSections(input: AssembleInput): PromptSection[] {
  const { scene, style } = input;
  const a = style?.attributes;
  const locked = new Set<StyleAttributeKey>(input.styleLocked && a ? (Object.keys(a) as StyleAttributeKey[]) : input.lockedStyleKeys ?? []);
  const lockedFields = new Set(scene.lockedFields);
  const hasSubject = scene.subject.kind !== "none";
  const sec: Record<SectionKey, { text: string; locked?: boolean }> = {} as never;

  // 1. Scene concept
  sec.concept = {
    text: join(
      scene.title && scene.title !== "Untitled scene" ? `"${scene.title}"` : "",
      scene.description,
      scene.freeDirection,
    ),
    locked: lockedFields.has("title") || lockedFields.has("description"),
  };

  // 2. Environment
  const tod = timeOfDayLanguage(scene.timeOfDay);
  sec.environment = {
    text: join(
      scene.environment && `Setting: ${scene.environment}${tod ? `, ${tod}` : ""}`,
      !scene.environment && tod ? `The scene takes place ${tod}` : "",
      scene.naturalElement && `The dominant natural element is ${scene.naturalElement}`,
    ),
    locked: lockedFields.has("environment"),
  };

  // 3-4. Character and action
  if (hasSubject) {
    sec.character = {
      text: join(
        characterLanguage(scene.subject),
        scene.secondarySubject && scene.secondarySubject.kind !== "none"
          ? characterLanguage(scene.secondarySubject, "secondary")
          : "",
      ),
      locked: lockedFields.has("subject"),
    };
    sec.action = { text: join(scene.subject.action && `Action: ${scene.subject.action}`), locked: lockedFields.has("subject") };
  } else {
    sec.character = { text: "There are no people, animals or characters in the scene; the environment itself is the subject." };
    sec.action = { text: "" };
  }

  // 5. Phenomenon
  sec.phenomenon = {
    text: scene.phenomenon
      ? join(
          `The impossible phenomenon: ${scene.phenomenon}`,
          "It is presented as physically real and photographed, not illustrated, with impossibility arising from scale, gravity, perspective or environmental relationships",
        )
      : "",
    locked: lockedFields.has("phenomenon"),
  };

  // 6-7. Scale and composition
  sec.scale = { text: scaleLanguage(scene.composition, hasSubject), locked: lockedFields.has("composition") };
  sec.composition = {
    text: join(compositionLanguage(scene.composition, hasSubject), a?.compositionPhilosophy),
    locked: lockedFields.has("composition") || locked.has("compositionPhilosophy"),
  };

  // 8. Materials
  sec.materials = {
    text: join(scene.materials && `Materials: ${scene.materials}, rendered with real physical texture`),
    locked: lockedFields.has("materials"),
  };

  // 9. Lighting
  sec.lighting = {
    text: join(scene.lighting && `Lighting: ${scene.lighting}`, a?.lighting),
    locked: lockedFields.has("lighting") || locked.has("lighting"),
  };

  // 10. Palette
  const paletteText = scene.palette.swatches.length ? paletteToLanguage(scene.palette) : "";
  sec.palette = {
    text: join(paletteText, a?.colorPhilosophy && `Colour philosophy: ${a.colorPhilosophy}`, a?.saturation),
    locked: lockedFields.has("palette") || locked.has("colorPhilosophy"),
  };

  // 11. Texture
  sec.texture = {
    text: join(a?.texture && `Texture: ${a.texture}`, a?.grain),
    locked: locked.has("texture") && locked.has("grain"),
  };

  // 12. Atmosphere
  sec.atmosphere = {
    text: join(scene.atmosphere && `Atmosphere: ${scene.atmosphere}`, a?.atmosphericDepth),
    locked: lockedFields.has("atmosphere"),
  };

  // 13. Emotion
  sec.emotion = {
    text: join(
      scene.emotionalTone && `Emotional tone: ${scene.emotionalTone}`,
      a?.emotionalCharacter && `Overall feeling: ${a.emotionalCharacter}`,
    ),
    locked: lockedFields.has("emotionalTone") || locked.has("emotionalCharacter"),
  };

  // 14. Style DNA
  sec.style = {
    text: a
      ? join(
          a.medium && `Medium: ${a.medium}`,
          a.renderingStyle,
          a.photographic,
          a.exposure && `Exposure: ${a.exposure}`,
          a.contrast && `Contrast: ${a.contrast}`,
          a.shadowDepth && `Shadows: ${a.shadowDepth}`,
          hasSubject && a.subjectTreatment && `Subject treatment: ${a.subjectTreatment}`,
          a.environmentalTreatment && `Environment treatment: ${a.environmentalTreatment}`,
          a.requiredElements.length ? `Always include ${listWithAnd(a.requiredElements)}` : "",
          a.positiveInstructions,
        )
      : "",
    locked: input.styleLocked,
  };

  // 15. References (only those actually submitted)
  const refs = input.references ?? [];
  sec.references = {
    text: refs.length
      ? join(
          `${refs.length} reference image${refs.length > 1 ? "s are" : " is"} attached`,
          refs
            .map((r, i) => {
              const role = REFERENCE_ROLE_OPTIONS.find((o) => o.key === r.role)?.label.toLowerCase() ?? r.role;
              return `image ${i + 1} is a ${role} reference${r.label ? ` (${r.label})` : ""}`;
            })
            .join("; "),
          "Use each reference only for its stated role. Do not copy their subjects or compositions unless that is the stated role",
        )
      : "",
  };

  // 16. Constraints
  const prohibited = a?.prohibitedElements ?? [];
  sec.constraints = {
    text: join(prohibited.length ? `Avoid ${listWithAnd(prohibited)}` : "", a?.negativeConstraints),
    locked: locked.has("prohibitedElements") || locked.has("negativeConstraints"),
  };

  // 17. Output
  const op = input.operation ?? "generate";
  const opLine =
    op === "variation"
      ? "This is a variation of the attached source image: keep its world and style, but explore a distinctly different interpretation."
      : op === "refine"
        ? "Refine the attached source image: preserve what works and apply only the requested changes."
        : "";
  sec.output = {
    text: join(
      opLine,
      input.instruction && `Direction for this ${op === "generate" ? "image" : op}: ${input.instruction}`,
      `Frame: ${orientationWord(scene.output.aspectRatio)} orientation, aspect ratio ${scene.output.aspectRatio}`,
      OUTPUT_REQUIREMENTS,
    ),
  };

  return SECTION_ORDER.map(([key, label]) => ({ key, label, text: sec[key].text, locked: sec[key].locked || undefined }))
    .filter((s) => s.text.trim().length > 0)
    .map((s) => ({ ...s, text: capitalize(s.text) }));
}

export const DEFAULT_TEMPLATE = SECTION_ORDER.map(([k]) => `{{${k}}}`).join("\n\n");

export function applyTemplate(template: string, sections: PromptSection[]): string {
  const byKey = new Map(sections.map((s) => [s.key, s.text]));
  let used = new Set<string>();
  const out = template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_, key: string) => {
    used.add(key);
    return byKey.get(key) ?? "";
  });
  // Output requirements are mandatory even if a template omits them.
  let text = out.replace(/\n{3,}/g, "\n\n").trim();
  if (!used.has("output")) text = ensureOutputRequirements(text);
  used = new Set();
  return text;
}

export function ensureOutputRequirements(text: string): string {
  const lower = text.toLowerCase();
  if (REQUIRED_PHRASES.every((p) => lower.includes(p))) return text;
  return `${text.trim()}\n\n${OUTPUT_REQUIREMENTS}`;
}

export function assemblePrompt(input: AssembleInput): AssembledPrompt {
  const sections = buildSections(input);
  const assembled = applyTemplate(input.template?.trim() ? input.template : DEFAULT_TEMPLATE, sections);
  const override = input.scene.promptOverride?.trim();
  if (override) {
    return { sections, assembled, text: ensureOutputRequirements(override), isManual: true };
  }
  return { sections, assembled, text: assembled, isManual: false };
}
