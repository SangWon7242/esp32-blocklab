/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { loadChapters, parseChapter } from "./content";
import type { Chapter, Step } from "./schema";
import { chapterDone, chaptersInTrack, PLANNED_CHAPTERS, prerequisiteViews } from "./tracks";

const root = join(process.cwd(), "content/chapters");
const dirs = readdirSync(root).filter((d) => existsSync(join(root, d, "chapter.yaml")));
/** 새 챕터 id 모양: 두세 자리 번호-영어 (예: 18-servo) */
const ID_PATTERN = /^[0-9]{2,3}-[a-z0-9]+(-[a-z0-9]+)*$/;

describe("트랙 메타 — 모든 챕터", () => {
  const chapters = loadChapters();

  it("모든 chapter.yaml 에 track·label 이 있고, 번호 머리글자가 트랙과 맞는다 (센서 S, 교과 융합 F)", () => {
    for (const d of dirs) {
      const raw = parse(readFileSync(join(root, d, "chapter.yaml"), "utf8")) as Record<string, unknown>;
      expect(raw.track, d).toMatch(/^(sensor|fusion)$/);
      expect(raw.label, d).toMatch(raw.track === "sensor" ? /^S\d+$/ : /^F\d+$/);
    }
  });

  it("번호는 트랙 안에서 겹치지 않는다", () => {
    const labels = chapters.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("먼저 할 챕터는 있는 챕터 id 이거나, 아직 없으면 id 모양(번호-영어)이다", () => {
    const ids = new Set(chapters.map((c) => c.id));
    for (const c of chapters) {
      for (const p of c.prerequisites ?? []) {
        expect(ids.has(p) || ID_PATTERN.test(p), `${c.id} → ${p}`).toBe(true);
        expect(p).not.toBe(c.id);
      }
    }
  });

  it("기존 챕터: 1~7 은 센서 S1~S7, 8·9·10 은 교과 융합 F1~F3 (먼저 할 챕터·교과·SDG)", () => {
    const by = (id: string) => chapters.find((c) => c.id === id)!;
    expect(chapters.filter((c) => c.order <= 7).map((c) => [c.track, c.label])).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((n) => ["sensor", `S${n}`]),
    );
    expect(by("08-access-control")).toMatchObject({ track: "fusion", label: "F1", prerequisites: ["18-servo", "22-rfid"], subjects: ["사회", "정보"] });
    expect(by("09-oled-access")).toMatchObject({ track: "fusion", label: "F2", prerequisites: ["08-access-control", "21-oled"], subjects: ["국어", "정보"] });
    expect(by("10-auto-door")).toMatchObject({
      track: "fusion", label: "F3", prerequisites: ["17-ultrasonic", "18-servo", "21-oled"], subjects: ["과학", "수학"], sdg: [11],
    });
    for (const c of chapters) {
      expect(c.sessions, c.id).toBeGreaterThan(0);
      expect(c.status, c.id).toBe("published");
    }
  });

  it("계획 챕터 표의 id 는 모두 id 모양이고 번호가 겹치지 않는다", () => {
    for (const id of Object.keys(PLANNED_CHAPTERS)) expect(id).toMatch(ID_PATTERN);
    const labels = Object.values(PLANNED_CHAPTERS).map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("트랙 메타 — 스키마", () => {
  const files = { "a.py": "print(1)\n" };
  const yaml = (head: string) =>
    `id: x\norder: 1\ntitle: x\n${head}parts:\n  - id: p\n    title: p\n    steps:\n      - { id: r, type: run, title: r, code: a.py }\n`;

  it("track·label 은 꼭 있어야 한다", () => {
    expect(() => parseChapter(yaml(""), files, "x")).toThrow(/track/);
    expect(() => parseChapter(yaml("track: sensor\n"), files, "x")).toThrow(/label/);
    expect(() => parseChapter(yaml("track: robot\nlabel: S1\n"), files, "x")).toThrow(/track/);
    expect(() => parseChapter(yaml("track: sensor\nlabel: s1\n"), files, "x")).toThrow(/label/);
  });

  it("선택 키를 받아들이고 status 기본값은 published", () => {
    const ch = parseChapter(
      yaml("track: fusion\nlabel: F3\nprerequisites: [17-ultrasonic, 01-led]\nsubjects: [과학, 수학]\nsdg: [11]\nsessions: 2\nteacherNotes: |\n  **준비** 서보를 미리 0도로\n"),
      files,
      "x",
    );
    expect(ch).toMatchObject({ track: "fusion", label: "F3", prerequisites: ["17-ultrasonic", "01-led"], subjects: ["과학", "수학"], sdg: [11], sessions: 2, status: "published" });
    expect(ch.teacherNotes).toContain("**준비**");
    expect(parseChapter(yaml("track: sensor\nlabel: S1\nstatus: draft\n"), files, "x").status).toBe("draft");
  });

  it("모양이 틀린 메타", () => {
    const bad = [
      "prerequisites: [Servo]\n", "prerequisites: []\n", "sdg: [18]\n", "sdg: [0]\n", "sessions: 0\n", "sessions: 1.5\n",
      "status: hidden\n", "subjects: []\n", "teacherNotes: ''\n",
    ];
    for (const b of bad) expect(() => parseChapter(yaml(`track: sensor\nlabel: S1\n${b}`), files, "x"), b).toThrow();
  });

  it("자기 자신·겹치는 id 를 먼저 할 챕터로 쓰면 걸린다", () => {
    expect(() => parseChapter(yaml("track: sensor\nlabel: S1\nprerequisites: [x]\n"), files, "x")).toThrow(/자기 자신/);
    expect(() => parseChapter(yaml("track: sensor\nlabel: S1\nprerequisites: [01-led, 01-led]\n"), files, "x")).toThrow(/두 번/);
  });
});

describe("트랙 목록·완료·먼저 할 챕터", () => {
  const step = (id: string, optional?: boolean): Step => ({ id, type: "problem", title: id, questions: ["?"], ...(optional ? { optional } : {}) });
  const ch = (id: string, track: "sensor" | "fusion", order: number, extra: Partial<Chapter> = {}): Chapter => ({
    id, order, title: `제목 ${id}`, track, label: `${track === "sensor" ? "S" : "F"}${order}`, status: "published",
    parts: [{ id: "p", title: "p", steps: [step("a"), step("b", true), step("c")] }],
    ...extra,
  });
  const chapters = [
    ch("02-b", "sensor", 2),
    ch("01-a", "sensor", 1),
    ch("03-draft", "sensor", 3, { status: "draft" }),
    ch("31-f", "fusion", 31, { prerequisites: ["01-a", "02-b", "18-servo", "99-unknown"] }),
  ];
  const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { status: "done" }]));

  it("트랙별·order 순, 초안은 교사 모드에서만", () => {
    expect(chaptersInTrack(chapters, "sensor", false).map((c) => c.id)).toEqual(["01-a", "02-b"]);
    expect(chaptersInTrack(chapters, "sensor", true).map((c) => c.id)).toEqual(["01-a", "02-b", "03-draft"]);
    expect(chaptersInTrack(chapters, "fusion", false).map((c) => c.id)).toEqual(["31-f"]);
  });

  it("필수 단계를 모두 끝내면 챕터 완료 (선택 단계는 따지지 않는다)", () => {
    expect(chapterDone(chapters[0], undefined)).toBe(false);
    expect(chapterDone(chapters[0], done("a"))).toBe(false);
    expect(chapterDone(chapters[0], done("a", "c"))).toBe(true);
  });

  it("먼저 할 챕터: 있는 챕터는 완료 여부, 계획 표에 있으면 번호·제목 + 준비 중, 모르는 id 는 id 그대로 준비 중", () => {
    expect(prerequisiteViews(chapters[3], chapters, { "01-a": done("a", "c"), "02-b": done("a") })).toEqual([
      { id: "01-a", label: "S1", title: "제목 01-a", state: "done" },
      { id: "02-b", label: "S2", title: "제목 02-b", state: "todo" },
      { id: "18-servo", label: "S15", title: "서보 모터", state: "planned" },
      { id: "99-unknown", label: undefined, title: "99-unknown", state: "planned" },
    ]);
    expect(prerequisiteViews(chapters[0], chapters, undefined)).toEqual([]);
  });
});
