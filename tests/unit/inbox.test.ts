import { describe, expect, it } from "vitest";
import { ideaTitle, splitSharedText } from "@/lib/services/ideas";

describe("ideas inbox", () => {
  it("pulls a link out of shared text", () => {
    expect(splitSharedText("Look at this light https://example.com/photo?id=3.", null)).toEqual({ text: "Look at this light", url: "https://example.com/photo?id=3" });
    expect(splitSharedText("Just words", null)).toEqual({ text: "Just words", url: null });
    expect(splitSharedText("Words", "https://a.com")).toEqual({ text: "Words", url: "https://a.com" });
  });

  it("titles an idea from its first line", () => {
    const at = "2026-11-24T10:00:00Z";
    expect(ideaTitle({ text: "A fox asleep in a lighthouse lamp.\nMore notes", url: null, createdAt: at })).toBe("A fox asleep in a lighthouse lamp");
    expect(ideaTitle({ text: "", url: "https://www.are.na/block/1", createdAt: at })).toBe("Idea from are.na");
    expect(ideaTitle({ text: "", url: null, createdAt: at })).toBe("Idea from your inbox");
    const long = ideaTitle({ text: "word ".repeat(40), url: null, createdAt: at });
    expect(long.length).toBeLessThanOrEqual(75);
    expect(long.endsWith("...")).toBe(true);
  });
});
