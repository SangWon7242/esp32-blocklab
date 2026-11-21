import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CHAPTER_HAZARDS, chapterSafety, HAZARDS, SAFETY_BASICS, type HazardId } from "./safety";

const root = join(__dirname, "../../content/chapters");

/** 챕터의 모든 보드판 장면에서 부품 kind · type 과 확장 보드 점퍼를 모은다 */
function sceneFacts(dir: string) {
  const kinds = new Set<string>();
  let jumper5 = false;
  const images = join(root, dir, "images");
  let files: string[] = [];
  try {
    files = readdirSync(images);
  } catch {
    return { kinds, jumper5 };
  }
  for (const f of files) {
    if (f.endsWith(".3d.json")) {
      const scene = JSON.parse(readFileSync(join(images, f), "utf8")) as { parts?: { kind?: string; type?: string }[] };
      for (const p of scene.parts ?? []) {
        if (p.kind) kinds.add(p.kind);
        if (p.type) kinds.add(p.type);
      }
    }
    if (f.endsWith(".expansion.svg") && readFileSync(join(images, f), "utf8").includes('data-expansion-jumper="5V"')) jumper5 = true;
  }
  return { kinds, jumper5 };
}

/** 장면에서 마땅히 나와야 하는 위험 */
function expectedHazards(dir: string): HazardId[] {
  const { kinds, jumper5 } = sceneFacts(dir);
  const out: HazardId[] = [];
  if (kinds.has("battery") || kinds.has("jack")) out.push("power");
  if (kinds.has("fan")) out.push("blade");
  if (kinds.has("pump") || kinds.has("relay") || kinds.has("water")) out.push("water");
  if (kinds.has("servo") || kinds.has("ultrasonic") || kinds.has("relay") || jumper5) out.push("five-volt");
  return out;
}

const chapters = readdirSync(root).filter((d) => !d.startsWith("."));

describe("조립 안전 안내", () => {
  it.each(chapters)("%s: 장면의 위험 부품과 경고 표가 맞는다", (dir) => {
    expect([...(CHAPTER_HAZARDS[dir] ?? [])].sort()).toEqual(expectedHazards(dir).sort());
  });

  it("위험(빨강)은 배터리 · 날개 · 물 챕터, 나머지는 주의(노랑)", () => {
    expect(chapterSafety("07-fan")?.level).toBe("danger");
    expect(chapterSafety("44-smart-plant")?.level).toBe("danger");
    expect(chapterSafety("18-servo")?.level).toBe("caution");
    expect(chapterSafety("01-led")).toBeNull();
    expect(chapterSafety(null)).toBeNull();
    // 위험한 것부터
    expect(chapterSafety("31-safe-fan")!.hazards.map((h) => h.id)).toEqual(["power", "blade", "five-volt"]);
  });

  it("늘 USB 를 먼저 빼라고 한다", () => {
    expect(SAFETY_BASICS[0]).toContain("USB 를 먼저 빼고");
    expect(chapterSafety("10-auto-door")!.basics).toBe(SAFETY_BASICS);
    for (const h of Object.values(HAZARDS)) expect(h.text.length).toBeLessThanOrEqual(90);
  });
});
