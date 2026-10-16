#!/usr/bin/env node
/*
 * dist-lib 선언 파일 검사 (lib-v1.0.1, build:lib 끝에 돈다. 따로: node scripts/lib-types-check.mjs).
 *   1. 허브처럼 zod 가 없는 임시 폴더(저장소 밖)에 d.ts 만 옮겨 tsc --noEmit 으로 읽는다.
 *      StepRecord·Progress·Chapter·Step·LoadedChapter·ChapterSnapshot 이 any 가 아니고 모양이 맞는지 본다.
 *   2. 저장소 안(zod 가 있는 곳)에서 펼친 d.ts 타입과 src 의 zod 타입(z.infer)이 양쪽으로 할당되는지 본다.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
    `import type { StepRecord, Progress, Chapter, Step, StepType, LoadedChapter, ChapterSnapshot, HostProps } from "./vendor/blocklab";
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
export { checks, rec, badStatus, badAttempts, progress, badVersion, type, badType, track, firstStep };
`,
  );
  tscIn(hub, "zod 없는 폴더");
} finally {
  rmSync(hub, { recursive: true, force: true });
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
  console.log(`d.ts 검사 통과: zod import 0, 허브식 폴더에서 any 아님, zod 타입과 같은 타입 ${tuple.length}개`);
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

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}
