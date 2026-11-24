import { describe, expect, it } from "vitest";
import { characterSchema, sceneContentSchema } from "@/lib/domain/schemas";
import { createRng } from "@/lib/explore/engine";
import { mentionsSubject, renameSubjectIn, retargetSubject } from "@/lib/scene/retarget";

const fox = characterSchema.parse({ kind: "fox", action: "sitting upright" });
const scene = (over: Record<string, unknown> = {}) =>
  sceneContentSchema.parse({
    title: "The Fox's Wish",
    description: "A fox sitting beneath a dandelion clock; two foxes watch from the ridge.",
    environment: "a dark meadow",
    phenomenon: "a dandelion clock as tall as a tree, dwarfing the fox",
    lighting: "moonlight rims the fox's fur",
    subject: fox,
    ...over,
  });

describe("renaming the subject in text", () => {
  it("replaces singular, plural and possessive mentions and fixes articles", () => {
    const owl = characterSchema.parse({ kind: "bird", label: "owl" });
    expect(renameSubjectIn("A fox and two foxes; the fox's tail.", fox, owl)).toBe("An owl and two owls; the owl's tail.");
    expect(renameSubjectIn("A fox and two foxes.", fox, characterSchema.parse({ kind: "horse" }))).toBe("A horse and two horses.");
  });

  it("keeps capitalisation and leaves unrelated words alone", () => {
    const horse = characterSchema.parse({ kind: "horse" });
    expect(renameSubjectIn("THE FOX. Fox at dusk. Foxglove.", fox, horse)).toBe("THE HORSE. Horse at dusk. Foxglove.");
  });

  it("uses synonyms and the old description", () => {
    const deer = characterSchema.parse({ kind: "deer", label: "a white stag" });
    const wolf = characterSchema.parse({ kind: "wolf" });
    expect(renameSubjectIn("A white stag stands where a doe once slept.", deer, wolf)).toBe("A wolf stands where a wolf once slept.");
  });
});

describe("retargeting a scene", () => {
  it("rewrites every field that names the old subject when the kind changes", () => {
    const { patch, changed } = retargetSubject(scene(), "subject", { ...fox, kind: "horse" }, { rand: createRng(1) });
    expect(patch.title).toBe("The Horse's Wish");
    expect(patch.description).toBe("A horse sitting beneath a dandelion clock; two horses watch from the ridge.");
    expect(patch.phenomenon).toContain("dwarfing the horse");
    expect(patch.lighting).toBe("moonlight rims the horse's fur");
    expect(patch.environment).toBeUndefined();
    expect(changed).toEqual(expect.arrayContaining(["title", "description", "phenomenon", "lighting"]));
  });

  it("replaces actions and clears details that belonged to another kind of subject", () => {
    const person = characterSchema.parse({ kind: "adult", action: "holding a small lantern at their side", pose: "one hand raised", clothing: "a long grey coat", label: "a woman in a grey coat" });
    const s = scene({ subject: person, description: "A woman in a grey coat holding a lantern." });
    const { patch, changed } = retargetSubject(s, "subject", { ...person, kind: "whale" }, { rand: createRng(3) });
    const whale = patch.subject!;
    expect(whale.kind).toBe("whale");
    expect(whale.label).toBe("");
    expect(whale.pose).toBe("");
    expect(whale.clothing).toBe("");
    expect(whale.action).not.toBe(person.action);
    expect(whale.action).not.toBe("");
    expect(patch.description).toBe("A whale holding a lantern.");
    expect(changed).toEqual(expect.arrayContaining(["subject description", "action", "pose", "clothing", "description"]));
  });

  it("keeps an action that suits both kinds", () => {
    const { patch, changed } = retargetSubject(scene(), "subject", { ...fox, kind: "wolf" });
    expect(patch.subject!.action).toBe("sitting upright");
    expect(changed).not.toContain("action");
  });

  it("follows a new subject description through the scene", () => {
    const s = scene({ subject: { ...fox, label: "a red fox" }, description: "A red fox in the snow." });
    const { patch } = retargetSubject(s, "subject", { ...fox, label: "an arctic fox" });
    expect(patch.description).toBe("An arctic fox in the snow.");
  });

  it("reports fields that still mention the subject when it is removed", () => {
    const { patch, unresolved } = retargetSubject(scene(), "subject", { ...fox, kind: "none" });
    expect(patch.description).toBeUndefined();
    expect(unresolved).toEqual(expect.arrayContaining(["title", "description"]));
    expect(mentionsSubject("A quiet meadow.", fox)).toBe(false);
  });

  it("leaves locked fields alone and reports them", () => {
    const { patch, unresolved } = retargetSubject(scene(), "subject", { ...fox, kind: "horse" }, { skip: ["title"] });
    expect(patch.title).toBeUndefined();
    expect(patch.description).toContain("horse");
    expect(unresolved).toEqual(["title"]);
  });

  it("changes nothing else when only other character settings change", () => {
    const { patch, changed } = retargetSubject(scene(), "subject", { ...fox, silhouetteStrength: 10 });
    expect(Object.keys(patch)).toEqual(["subject"]);
    expect(changed).toEqual([]);
  });
});
