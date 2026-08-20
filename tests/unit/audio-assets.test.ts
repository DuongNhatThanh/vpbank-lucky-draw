import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PRESENTATION_AUDIO_ASSETS } from "../../src/presentation/audio";

describe("presentation audio assets", () => {
  it("maps every configured sound to a supplied local public asset", () => {
    for (const assetPath of Object.values(PRESENTATION_AUDIO_ASSETS)) {
      expect(existsSync(resolve(process.cwd(), "public", assetPath.slice(1)))).toBe(true);
    }
  });
});
