#!/usr/bin/env node
/*
 * dist-lib 선언 파일 검사 (lib-v1.0.1, build:lib 끝에 돈다. 따로: node scripts/lib-types-check.mjs).
 *   1. 허브처럼 zod 가 없는 임시 폴더(저장소 밖)에 d.ts 만 옮겨 tsc --noEmit 으로 읽는다.
 *      StepRecord·Progress·Chapter·Step·LoadedChapter·ChapterSnapshot 이 any 가 아니고 모양이 맞는지 본다.
 *   1b. (lib-v1.0.2) 서버 입구 core.d.ts: zod·React 타입이 모두 없는 폴더(node_modules 없음)에서 허브 tsconfig 의
 *       paths(`@blocklab/*` → vendor/blocklab/*)로 `@blocklab/core` 를 읽는다. 내보내는 타입·함수가 any 가 아니고,
 *       core.d.ts 에서 닿는 선언 어디에도 바깥 패키지 import 가 없다.
 *   2. 저장소 안(zod 가 있는 곳)에서 펼친 d.ts 타입과 src 의 zod 타입(z.infer)이 양쪽으로 할당되는지 본다.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist-lib");
const tsc = path.join(root, "node_modules/typescript/bin/tsc");
const nodeModules = path.join(root, "node_modules");

// 0. 선언 어디에도 zod 가 없어야 한다
const dtsFiles = walk(dist).filter((f) => f.endsWith(".d.ts"));
const withZod = dtsFiles.filter((f) => /from\s+["']zod["']|import\(["']zod["']\)/.test(readFileSync(f, "utf8")));
assert.deepEqual(withZod.map((f) => path.relative(dist, f)), [], "d.ts 에 zod import 가 남아 있어요");

const strict = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  target: "es2023",
  lib: ["ES2023", "DOM"],
  module: "esnext",
  moduleResolution: "bundler",
  jsx: "react-jsx",
  types: [],
};

/* 1. 허브처럼: zod 없는 폴더 */
const hub = mkdtempSync(path.join(os.tmpdir(), "blocklab-types-"));
try {
  for (const f of dtsFiles) {
    const to = path.join(hub, "vendor/blocklab", path.relative(dist, f));
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(f, to);
  }
  // 허브에 있는 것만: React 타입(그 의존 csstype). zod 는 두지 않는다
  for (const name of ["@types/react", "@types/react-dom", "csstype"]) {
    mkdirSync(path.dirname(path.join(hub, "node_modules", name)), { recursive: true });
    symlinkSync(path.join(nodeModules, name), path.join(hub, "node_modules", name));
  }
  writeFileSync(path.join(hub, "tsconfig.json"), JSON.stringify({ compilerOptions: strict, files: ["consumer.ts"] }, null, 2));
  writeFileSync(
    path.join(hub, "consumer.ts"),
    `import type { StepRecord, Progress, Chapter, Step, StepType, LoadedChapter, ChapterSnapshot, HostProps, LabViewProps, LabInitialProgram } from "./vendor/blocklab";
type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? false : true;
const checks: [NotAny<StepRecord>, NotAny<Progress>, NotAny<Chapter>, NotAny<Step>, NotAny<StepType>, NotAny<LoadedChapter>, NotAny<ChapterSnapshot>, NotAny<HostProps["store"]>, NotAny<StepRecord["status"]>] =
  [true, true, true, true, true, true, true, true, true];
const rec: StepRecord = { status: "done", input: { program: { code: "" } }, attempts: 1, updatedAt: "2026-10-17T00:00:00.000000+00:00" };
// @ts-expect-error status 는 locked·open·done 만
const badStatus: StepRecord = { ...rec, status: "nope" };
// @ts-expect-error attempts 는 수
const badAttempts: StepRecord = { ...rec, attempts: "1" };
const progress: Progress = { version: 1, chapters: { "01-led": { s1: rec } } };
// @ts-expect-error version 은 1
const badVersion: Progress = { version: 2, chapters: {} };
const type: StepType = "mission";
// @ts-expect-error 없는 단계 유형
const badType: StepType = "nope";
const track: Chapter["track"] = "sensor";
const firstStep = (c: Chapter): Step | undefined => c.parts[0]?.steps[0];
// lib-v1.0.3: LabViewProps.initialProgram (허브가 ?project= 작품을 싣는다)
const labChecks: [NotAny<LabViewProps>, NotAny<NonNullable<LabViewProps["initialProgram"]>>, NotAny<LabInitialProgram["code"]>] = [true, true, true];
const sameProgram: LabInitialProgram = { code: "print(1)", blocksJson: { blocks: {} }, title: "깜빡이" } satisfies NonNullable<LabViewProps["initialProgram"]>;
const codeOnly: LabViewProps = { initialProgram: { code: "" }, codeRef: null };
// @ts-expect-error code 는 꼭 있어야 한다
const noCode: LabViewProps = { initialProgram: { blocksJson: {} } };
// @ts-expect-error title 은 글
const badTitle: LabViewProps = { initialProgram: { code: "", title: 1 } };
export { checks, rec, badStatus, badAttempts, progress, badVersion, type, badType, track, firstStep, labChecks, sameProgram, codeOnly, noCode, badTitle };
`,
  );
  tscIn(hub, "zod 없는 폴더");
} finally {
  rmSync(hub, { recursive: true, force: true });
}

/* 1b. 서버 입구 core.d.ts: zod·React 없는 폴더 */
const coreDtsReached = dtsClosure(path.join(dist, "core.d.ts"));
const coreDtsExternal = [];
for (const f of coreDtsReached) {
  for (const spec of dtsSpecs(readFileSync(f, "utf8"))) if (!spec.startsWith(".")) coreDtsExternal.push(`${path.relative(dist, f)} → ${spec}`);
}
assert.deepEqual(coreDtsExternal, [], `core.d.ts 에서 닿는 선언이 바깥 패키지를 import 해요: ${coreDtsExternal.join(", ")}`);
const bare = mkdtempSync(path.join(os.tmpdir(), "blocklab-core-types-"));
try {
  for (const f of dtsFiles) {
    const to = path.join(bare, "vendor/blocklab", path.relative(dist, f));
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(f, to);
  }
  // 허브 tsconfig 와 같은 paths. node_modules 는 만들지 않는다 (zod·react·@types 모두 없음)
  const opts = { ...strict, jsx: undefined, baseUrl: undefined, paths: { "@blocklab": ["./vendor/blocklab"], "@blocklab/*": ["./vendor/blocklab/*"] } };
  writeFileSync(path.join(bare, "tsconfig.json"), JSON.stringify({ compilerOptions: opts, files: ["server.ts"] }, null, 2));
  writeFileSync(
    path.join(bare, "server.ts"),
    `import {
  judgeSnapshot, chapterSnapshot, textAnswersOf, loadChapters, getChapter, judge, codeToBlocks, allSteps, stepStates,
  emptyProgress, parseProgress, TRACKS, TRACK_NAME, chaptersInTrack, isTrackId,
  SYSTEM_PROMPT, reflectMessage, debugMessage, parseReview, savedPrograms, isJudgedStep, isSkipped, hasRun,
  NOTE_SKIPPED, NOTE_NO_PROGRAM, NOTE_OUTPUT_RULES, NOTE_SCREEN_PASSED, NOTE_SCREEN_FAILED, EXPLAIN_MEMO_PROMPT, LIB_VERSION,
} from "@blocklab/core";
import type {
  LoadedChapter, ChapterSnapshot, TextAnswer, JudgeSummary, JudgeStepSummary, JudgeSnapshotOptions,
  Progress, ProgressStore, StepRecord, Chapter, Step, StepType, TrackId, AiReview, ReflectRequest, DebugRequest, SavedProgram,
} from "@blocklab/core";
type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? false : true;
type AllNotAny<T extends unknown[]> = { [K in keyof T]: NotAny<T[K]> };
const types: AllNotAny<[LoadedChapter, ChapterSnapshot, TextAnswer, JudgeSummary, JudgeStepSummary, JudgeSnapshotOptions, Progress, ProgressStore,
  StepRecord, StepRecord["status"], Chapter, Step, StepType, TrackId, AiReview, ReflectRequest, DebugRequest, SavedProgram]> =
  [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
const values: AllNotAny<[typeof judgeSnapshot, typeof chapterSnapshot, typeof textAnswersOf, typeof loadChapters, typeof getChapter, typeof judge,
  typeof codeToBlocks, ReturnType<typeof codeToBlocks>, typeof allSteps, typeof stepStates, typeof emptyProgress, typeof parseProgress, typeof TRACKS,
  typeof TRACK_NAME, typeof chaptersInTrack, typeof isTrackId, typeof reflectMessage, typeof debugMessage, typeof parseReview, typeof savedPrograms,
  typeof isJudgedStep, typeof isSkipped, typeof hasRun]> =
  [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
const notes: string[] = [NOTE_SKIPPED, NOTE_NO_PROGRAM, NOTE_OUTPUT_RULES, NOTE_SCREEN_PASSED, NOTE_SCREEN_FAILED, EXPLAIN_MEMO_PROMPT, SYSTEM_PROMPT, LIB_VERSION];
// @ts-expect-error NOTE_* 는 글
const badNote: number = NOTE_SKIPPED;
const chapter: LoadedChapter | undefined = getChapter("01-led");
const summary: JudgeSummary | undefined = chapter && judgeSnapshot(chapter, chapterSnapshot(emptyProgress(), chapter.id));
const passed: number | undefined = summary?.passed;
// @ts-expect-error judgeSnapshot 은 스냅숏을 받는다
judgeSnapshot(chapter!, { chapterId: 1 });
const track: TrackId = "fusion";
// @ts-expect-error 없는 트랙
const badTrack: TrackId = "nope";
export { types, values, notes, badNote, summary, passed, track, badTrack };
`,
  );
  tscIn(bare, "core.d.ts, zod·React 없는 폴더");
} finally {
  rmSync(bare, { recursive: true, force: true });
}

/* 2. 펼친 타입 = zod 타입 (저장소 안, zod 있음) */
const eqDir = path.join(dist, ".types-check");
try {
  mkdirSync(eqDir, { recursive: true });
  const names = {
    schema: ["Figure", "LineInside", "BlocksRule", "Rule", "CodeNote", "ReadQuestion", "AppApi", "AppReadQuestion", "Step", "StepType", "Part", "TrackId", "Chapter"],
    progress: ["StepRecord", "Progress"],
  };
  const lines = [
    `import type * as SrcSchema from "../../src/track/schema";`,
    `import type * as SrcProgress from "../../src/track/progress";`,
    `import type * as LibSchema from "../types/track/schema";`,
    `import type * as LibProgress from "../types/track/progress";`,
    `type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;`,
    `type IsAny<T> = 0 extends 1 & T ? true : false;`,
  ];
  const tuple = [];
  for (const [mod, list] of Object.entries(names)) {
    const M = mod === "schema" ? "Schema" : "Progress";
    for (const n of list) {
      lines.push(`type ${n}Same = Same<Src${M}.${n}, Lib${M}.${n}> extends true ? (IsAny<Lib${M}.${n}> extends true ? false : true) : false;`);
      tuple.push(`${n}Same`);
    }
  }
  lines.push(`export const same: [${tuple.join(", ")}] = [${tuple.map(() => "true").join(", ")}];`);
  writeFileSync(path.join(eqDir, "eq.ts"), `${lines.join("\n")}\n`);
  writeFileSync(path.join(eqDir, "tsconfig.json"), JSON.stringify({ compilerOptions: strict, files: ["eq.ts"] }, null, 2));
  tscIn(eqDir, "펼친 타입과 zod 타입 비교");
  console.log(
    `d.ts 검사 통과: zod import 0, 허브식 폴더에서 any 아님, zod 타입과 같은 타입 ${tuple.length}개, ` +
      `core.d.ts 선언 ${coreDtsReached.size}개 바깥 import 0·zod·React 없는 폴더에서 @blocklab/core any 아님`,
  );
} finally {
  rmSync(eqDir, { recursive: true, force: true });
}

function tscIn(dir, what) {
  try {
    execFileSync(process.execPath, [tsc, "-p", path.join(dir, "tsconfig.json")], { cwd: dir, stdio: "pipe" });
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    throw new Error(`d.ts 검사 실패 (${what}):\n${out}`);
  }
}

/** d.ts 의 import·export from·import("…") 대상 */
function dtsSpecs(src) {
  return [...src.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|^import\s+["']([^"']+)["']/gm)].map((m) => m[1] ?? m[2] ?? m[3]);
}

/** d.ts 에서 상대 경로로 닿는 선언 파일들 */
function dtsClosure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of dtsSpecs(readFileSync(file, "utf8"))) {
      if (!spec.startsWith(".")) continue;
      const base = path.resolve(path.dirname(file), spec.replace(/\.js$/, ""));
      const hit = [`${base}.d.ts`, path.join(base, "index.d.ts")].find((p) => existsSync(p));
      assert.ok(hit, `${path.relative(dist, file)} 의 ${spec} 선언을 못 찾았어요`);
      queue.push(hit);
    }
  }
  return seen;
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}
