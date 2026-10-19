#!/usr/bin/env node
/*
 * dist-lib/index.js 연기 검사 (npm run test:lib, build:lib 끝에도 돈다).
 * 허브 서버(Node, window 없음)가 index.js 를 import 해 순수 API(loadChapters·judge·codeToBlocks)를 쓸 수 있어야 한다.
 * 화면(Blockly·CodeMirror)은 lazy 조각이라 import 때 끌려오지 않아야 한다.
 * lib-v1.0.2: 서버 입구 core.js 는 정적으로 닿는 조각 전체에 React·DOM UI·Blockly·CodeMirror·CSS·"use client" 가 없어야 한다
 * (Next 라우트 핸들러가 react-server 층에서 정적 import 한다). 콘텐츠 조각은 index·core 가 같은 파일을 함께 쓴다.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist-lib");
const indexJs = path.join(dist, "index.js");
assert.ok(existsSync(indexJs), "dist-lib/index.js 가 없어요. 먼저 npm run build:lib");

assert.equal(typeof globalThis.window, "undefined", "이 검사는 window 없는 Node 에서 돌아야 해요");
assert.equal(typeof globalThis.document, "undefined");

// 정적 import 에 Blockly·CodeMirror 조각이 없어야 한다 (화면은 lazy → dynamic import)
const text = readFileSync(indexJs, "utf8");
const staticImports = [...text.matchAll(/^import\b[^;]*?from\s*["']([^"']+)["']|^import\s*["']([^"']+)["']/gm)].map((m) => m[1] ?? m[2]);
const heavy = staticImports.filter((s) => /blockly|codemirror/i.test(s));
assert.deepEqual(heavy, [], `index.js 가 무거운 조각을 바로 import 해요: ${heavy.join(", ")}`);
for (const s of staticImports) assert.ok(/^react(\/|$)|^react-dom(\/|$)|^\.\//.test(s), `뜻밖의 외부 import: ${s}`);

// index.js 가 정적으로 닿는 조각 전체(전이)에도 Blockly·CodeMirror 조각과 CSS import 가 없어야 한다 — Node 가 실제로 읽는 범위
const reached = staticClosure("index.js");
const heavyChunks = [...reached].filter((f) => /(^|\/)(blockly|codemirror|renderBlock|codegen|EditorWorkbench)-/.test(f));
assert.deepEqual(heavyChunks, [], `순수 경로가 무거운 조각에 닿아요: ${heavyChunks.join(", ")}`);
for (const f of reached) {
  const t = readFileSync(path.join(dist, f), "utf8");
  assert.ok(!/^import\s*["'][^"']+\.css["']/m.test(t), `${f} 에 CSS import 가 남아 있어요 (style.css 로 빠져야 해요)`);
}

const lib = await import(pathToFileURL(indexJs).href);
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(lib.LIB_VERSION, pkg.version);
assert.equal(JSON.parse(readFileSync(path.join(dist, "package.json"), "utf8")).version, pkg.version);

for (const name of ["setBlocklyMediaPath", "blocklyMediaPath", "ChapterReviewView", "ProjectPreview", "CodeView", "SubmitCard", "SubmitCardView", "canSubmitChapter", "chapterSnapshot", "textAnswersOf", "judgeSnapshot", "loadBlockTools", "BlocklabProvider", "useHost", "TrackListView", "ChapterView", "StepView", "LabView", "loadChapters", "getChapter", "judge", "codeToBlocks", "stepStates", "allSteps", "LocalProgressStore", "reflectMessage", "debugMessage", "parseReview"]) {
  assert.equal(typeof lib[name], "function", `${name} 이 함수가 아니에요`);
}

// 순수 API
const chapters = lib.loadChapters();
assert.ok(chapters.length >= 39, `챕터가 ${chapters.length}개뿐이에요`);
const led = lib.getChapter("01-led");
assert.ok(led, "01-led 챕터가 없어요");
const mission = lib.allSteps(led).find((s) => s.type === "mission");
assert.ok(mission, "01-led 에 미션 단계가 없어요");
const answer = led.files[mission.answerCode ?? mission.code];
assert.ok(answer, "미션 코드 파일이 없어요");
const parsed = lib.codeToBlocks(answer);
assert.equal(parsed.ok, true, "정답 코드를 블록으로 못 바꿨어요");
const verdict = lib.judge(mission.rules, { code: answer, blocksJson: parsed.json }, led.files);
assert.equal(typeof verdict.pass, "boolean");
assert.ok(Array.isArray(verdict.failures));
const states = lib.stepStates(led, {}, false, { explainGate: false });
assert.ok(Object.keys(states).length > 0);

// 제출 스냅숏 다시 판정: 01-led 의 미션은 정답 코드, 설계는 목표 코드로 기록을 만들면 판정 단계가 모두 통과
const judged = lib.allSteps(led).filter((s) => s.type === "mission" || s.type === "debug" || s.type === "design");
const now = new Date().toISOString();
const rec = (code) => ({ status: "done", input: { program: { code } }, attempts: 1, updatedAt: now });
const records = {};
for (const s of judged) {
  if (s.type === "mission") records[s.id] = rec(led.files[s.answerCode ?? s.code]);
  if (s.type === "design") records[s.id] = rec(led.files[s.targetCode]);
}
const progress = lib.emptyProgress();
progress.chapters[led.id] = records;
const snapshot = lib.chapterSnapshot(progress, led.id);
assert.equal(snapshot.chapterId, led.id);
assert.equal(snapshot.programs.length, Object.keys(records).length);
const summary = lib.judgeSnapshot(led, snapshot);
assert.equal(summary.missions, judged.length, `01-led 판정 단계 수가 달라요: ${summary.missions}`);
assert.ok(summary.missions >= 2, "01-led 에 미션·설계 단계가 둘 이상 있어야 해요");
assert.equal(summary.passed, summary.missions, `01-led 정답 기록이 다 통과하지 않았어요: ${JSON.stringify(summary.steps)}`);
const answers = lib.textAnswersOf(led, snapshot);
assert.ok(Array.isArray(answers));
// 빈 스냅숏: 판정 단계는 그대로 세고 통과는 0, 프로그램 없음은 null
const empty = lib.judgeSnapshot(led, lib.chapterSnapshot(lib.emptyProgress(), led.id));
assert.equal(empty.missions, summary.missions);
assert.equal(empty.passed, 0);
assert.ok(empty.steps.every((s) => s.passed === null));

// lib-v1.0.2: 서버 입구 core.js
const coreJs = path.join(dist, "core.js");
assert.ok(existsSync(coreJs), "dist-lib/core.js 가 없어요");
assert.ok(existsSync(path.join(dist, "core.d.ts")), "dist-lib/core.d.ts 가 없어요");
const coreReached = staticClosure("core.js");
const BANNED_SPEC = /^(react|react-dom|radix-ui|@radix-ui\/|lucide|lucide-react|sonner|next-themes|blockly|@blockly\/|codemirror|@codemirror\/)(\/|$)|\.css$/;
const coreExternal = [];
for (const f of coreReached) {
  const t = readFileSync(path.join(dist, f), "utf8");
  for (const spec of importSpecs(t)) {
    if (!spec.startsWith(".")) coreExternal.push(`${f} → ${spec}`);
    else assert.ok(!BANNED_SPEC.test(spec), `${f} 가 ${spec} 를 import 해요`);
  }
  // 동적 import 도 없어야 한다 (번들러가 서버 묶음에 화면 조각을 끌어오지 않게)
  assert.ok(!/\bimport\(\s*["']/.test(t), `${f} 에 동적 import 가 있어요`);
  assert.ok(!/^\s*["']use client["']/m.test(t), `${f} 에 "use client" 가 있어요`);
  for (const word of ["createContext", "useState", "useEffect", "react/jsx-runtime", "react.element", "Blockly.inject", "EditorView"]) {
    assert.ok(!t.includes(word), `${f} 에 ${word} 가 있어요 (React·화면 코드)`);
  }
}
// 외부 패키지 import 가 하나도 없다 — react·react-dom·radix·lucide·sonner·blockly·codemirror 모두 포함
assert.deepEqual(coreExternal, [], `core 경로가 외부 패키지를 import 해요: ${coreExternal.join(", ")}`);
const coreHeavy = [...coreReached].filter((f) => /(^|\/)(blockly|codemirror|renderBlock|codegen|EditorWorkbench|button|dialog|tabs|SubmitCard|AiCheck|StepTypeIcon|card|mediaPath)-/.test(f));
assert.deepEqual(coreHeavy, [], `core 경로가 화면 조각에 닿아요: ${coreHeavy.join(", ")}`);
// 콘텐츠(약 3MB)는 한 조각뿐이고 index·core 가 같은 것을 쓴다
const contentChunks = readdirSync(path.join(dist, "chunks")).filter((f) => /^content-.*\.js$/.test(f));
assert.equal(contentChunks.length, 1, `콘텐츠 조각이 ${contentChunks.length}개예요`);
assert.ok(coreReached.has(`chunks/${contentChunks[0]}`) && reached.has(`chunks/${contentChunks[0]}`), "index·core 가 같은 콘텐츠 조각을 쓰지 않아요");
const coreBytes = [...coreReached].reduce((a, f) => a + statSync(path.join(dist, f)).size, 0);

const core = await import(pathToFileURL(coreJs).href);
assert.equal(core.LIB_VERSION, pkg.version);
const CORE_FUNCTIONS = ["loadChapters", "getChapter", "judge", "codeToBlocks", "chapterSnapshot", "textAnswersOf", "judgeSnapshot", "allSteps", "stepStates", "emptyProgress", "parseProgress", "chaptersInTrack", "isTrackId", "reflectMessage", "debugMessage", "parseReview", "savedPrograms", "isJudgedStep", "isSkipped", "hasRun", "searchChapters", "buildChapterSearchIndex", "matchChapter", "chapterDevices"];
for (const name of CORE_FUNCTIONS) {
  assert.equal(typeof core[name], "function", `core.${name} 이 함수가 아니에요`);
  assert.equal(lib[name], core[name], `index.${name} 과 core.${name} 이 같은 함수가 아니에요 (조각 공유가 깨짐)`);
}
const CORE_STRINGS = ["NOTE_SKIPPED", "NOTE_NO_PROGRAM", "NOTE_OUTPUT_RULES", "NOTE_SCREEN_PASSED", "NOTE_SCREEN_FAILED", "EXPLAIN_MEMO_PROMPT", "SYSTEM_PROMPT"];
for (const name of CORE_STRINGS) {
  assert.ok(typeof core[name] === "string" && core[name].length > 0, `core.${name} 이 글이 아니에요`);
  assert.equal(lib[name], core[name], `index.${name} 이 core 와 달라요`);
}
assert.equal(core.NOTE_SCREEN_PASSED, "학생 화면의 마지막 판정은 통과였어요");
assert.ok(Array.isArray(core.TRACKS) && core.TRACK_NAME.sensor, "TRACKS·TRACK_NAME 이 없어요");
for (const name of ["BlocklabProvider", "SubmitCard", "ChapterView", "LocalProgressStore", "loadBlockTools", "setBlocklyMediaPath"]) {
  assert.equal(core[name], undefined, `core 가 화면·브라우저 API ${name} 을 내보내요`);
}
// lib-v1.0.6: 챕터 찾기 (순수 — 서버에서도)
const found = core.searchChapters(core.loadChapters(), "초음파");
assert.equal(found[0]?.id, "17-ultrasonic", "searchChapters(\"초음파\") 첫 결과가 17-ultrasonic 이 아니에요");
assert.ok(found[0].matchedIn.includes("제목") && found[0].snippets.length > 0, "찾기 결과에 matchedIn·snippets 가 없어요");
assert.equal(core.searchChapters(core.buildChapterSearchIndex(core.loadChapters()), "ㅊㅇㅍ")[0]?.id, "17-ultrasonic");
const coreLed = core.getChapter("01-led");
const coreSummary = core.judgeSnapshot(coreLed, core.chapterSnapshot(progress, coreLed.id));
assert.equal(coreSummary.passed, coreSummary.missions);
assert.equal(coreSummary.missions, summary.missions);
// 건너뛴 단계는 NOTE_SKIPPED 로 적힌다
const skippedProgress = core.emptyProgress();
const firstJudged = judged[0];
skippedProgress.chapters[coreLed.id] = { [firstJudged.id]: { status: "done", input: { skipped: true }, attempts: 0, updatedAt: now } };
const skippedSummary = core.judgeSnapshot(coreLed, core.chapterSnapshot(skippedProgress, coreLed.id));
const skippedStep = skippedSummary.steps.find((s) => s.stepId === firstJudged.id);
assert.ok(skippedStep, `건너뛴 단계 ${firstJudged.id} 판정 줄이 없어요`);
assert.equal(skippedStep.passed, null);
assert.deepEqual(skippedStep.notes, [core.NOTE_SKIPPED]);
const distPkg = JSON.parse(readFileSync(path.join(dist, "package.json"), "utf8"));
assert.deepEqual(distPkg.exports["./core"], { types: "./core.d.ts", import: "./core.js", default: "./core.js" });

// import 뒤에도 DOM 흔적이 없어야 한다
assert.equal(typeof globalThis.window, "undefined");
assert.equal(typeof globalThis.document, "undefined");

// lib-v1.0.1: Blockly UMD 의 AMD 갈래가 없다 (허브 Turbopack 이 define([...]) 의존을 풀다 멈춤 — scripts/vite-blockly.ts)
const jsFiles = walk(dist).filter((f) => f.endsWith(".js"));
const amd = jsFiles.filter((f) => readFileSync(f, "utf8").includes("define.amd")).map((f) => path.relative(dist, f));
assert.deepEqual(amd, [], `dist-lib 에 define.amd 가 남아 있어요: ${amd.join(", ")}`);

// lib-v1.0.1: Blockly media 가 dist-lib/media/ 에 있고, 번들은 static.blockly.com 대신 /blocklab/media/ 를 쓴다
const mediaDir = path.join(dist, "media");
for (const name of ["sprites.svg", "click.mp3", "delete.mp3", "disconnect.mp3", "drop.mp3", "handopen.cur", "delete-icon.svg", "foldout-icon.svg", "resize-handle.svg"]) {
  assert.ok(existsSync(path.join(mediaDir, name)), `dist-lib/media/${name} 이 없어요`);
}
assert.equal(lib.DEFAULT_BLOCKLY_MEDIA_PATH, "/blocklab/media/");
assert.equal(lib.blocklyMediaPath(), "/blocklab/media/");
lib.setBlocklyMediaPath("/x/media");
assert.equal(lib.blocklyMediaPath(), "/x/media/");
lib.setBlocklyMediaPath(undefined);
assert.equal(lib.blocklyMediaPath(), "/blocklab/media/");
// Blockly.inject({ media: blocklyMediaPath(), … }) — 압축된 이름이라 "media: <함수>()" 꼴로 센다 (편집기·숨긴 렌더 작업판)
const injectsWithMedia = jsFiles.filter((f) => !/(^|\/)blockly-[^/]*\.js$/.test(f) && /\bmedia:\s*[\w$]+\(\)/.test(readFileSync(f, "utf8")));
assert.ok(injectsWithMedia.length >= 2, `media 를 넘기는 Blockly.inject 가 ${injectsWithMedia.length}곳뿐이에요 (편집기·숨긴 렌더 작업판)`);

// lib-v1.0.1: 선언 파일에 zod 가 없다 (허브에는 zod 가 없어 StepRecord·Progress 가 any 로 풀렸다 — scripts/dts-strip-zod.mjs)
const dtsZod = walk(dist)
  .filter((f) => f.endsWith(".d.ts") && /from\s+["']zod["']|import\(["']zod["']\)/.test(readFileSync(f, "utf8")))
  .map((f) => path.relative(dist, f));
assert.deepEqual(dtsZod, [], `d.ts 에 zod import 가 남아 있어요: ${dtsZod.join(", ")}`);

// 선언 파일·CSS 가 함께 있다
assert.ok(existsSync(path.join(dist, "index.d.ts")));
assert.ok(existsSync(path.join(dist, "style.css")));
const css = readFileSync(path.join(dist, "style.css"), "utf8");
assert.ok(css.includes(".blocklab"), "style.css 에 .blocklab 범위가 없어요");
assert.ok(!/(^|[}{;,])(html|body|:root|:host)[\s,{]/.test(css), "style.css 에 범위 밖 루트 선택자가 있어요");
assert.ok(css.includes("var(--host-primary"), "호스트 토큰 상속(--host-primary)이 없어요");

// lib-v1.0.5: 코드 글꼴 D2Coding — dist-lib/fonts/ 에 woff2·OFL.txt, style.css 에 @font-face(/blocklab/fonts/)·글꼴 스택·리가처 끄기
const fontsDir = path.join(dist, "fonts");
const fontFiles = existsSync(fontsDir) ? readdirSync(fontsDir) : [];
const woff2 = fontFiles.filter((f) => f.endsWith(".woff2"));
assert.ok(woff2.length >= 1, "dist-lib/fonts/ 에 woff2 가 없어요");
assert.ok(fontFiles.includes("OFL.txt"), "dist-lib/fonts/OFL.txt (SIL OFL 1.1) 가 없어요");
assert.match(readFileSync(path.join(fontsDir, "OFL.txt"), "utf8"), /SIL OPEN FONT LICENSE Version 1\.1/i);
const fontFaces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
const d2Face = fontFaces.find((f) => /font-family:\s*["']?D2Coding["']?\s*;/.test(f));
assert.ok(d2Face, "style.css 에 D2Coding @font-face 가 없어요");
assert.match(d2Face, /font-display:\s*swap/, "D2Coding @font-face 에 font-display: swap 이 없어요");
const faceUrls = [...d2Face.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);
assert.ok(faceUrls.length > 0, "D2Coding @font-face 에 url 이 없어요");
for (const u of faceUrls) {
  assert.ok(u.startsWith("/blocklab/fonts/"), `글꼴 주소가 /blocklab/fonts/ 가 아니에요: ${u}`);
  assert.ok(existsSync(path.join(fontsDir, u.slice("/blocklab/fonts/".length))), `style.css 가 부르는 ${u} 가 dist-lib/fonts/ 에 없어요`);
}
assert.ok(css.includes('"D2Coding", "D2Coding ligature", ui-monospace, "SF Mono", Menlo, Consolas, monospace') || css.includes('"D2Coding","D2Coding ligature",ui-monospace,"SF Mono",Menlo,Consolas,monospace'), "style.css 에 코드 글꼴 스택이 없어요");
assert.ok(/font-variant-ligatures:\s*none/.test(css), "style.css 에 리가처 끄기(font-variant-ligatures: none)가 없어요");
assert.ok(css.includes("--blocklab-code-font-size"), "style.css 에 --blocklab-code-font-size 가 없어요");

console.log(
  `dist-lib 연기 검사 통과: v${lib.LIB_VERSION}, 챕터 ${chapters.length}개, 01-led 미션 판정 ${verdict.pass ? "통과" : `실패(${verdict.failures.length})`}, ` +
    `judgeSnapshot ${summary.passed}/${summary.missions}, 정적 조각 ${reached.size}개, define.amd 0, media ${readdirSync(mediaDir).length}개, 글꼴 ${woff2.join("·")} + OFL.txt, d.ts zod 0\n` +
    `core 입구 통과: judgeSnapshot ${coreSummary.passed}/${coreSummary.missions}, 정적 조각 ${coreReached.size}개(${(coreBytes / 1024).toFixed(1)} kB), ` +
    `외부 import 0, "use client"·React·Blockly·CodeMirror·CSS 0, 함수 ${CORE_FUNCTIONS.length}개 index 와 같음, 문장 상수 ${CORE_STRINGS.length}개`,
);

/** index.js 에서 정적 import 로 닿는 dist-lib 안 파일들 (동적 import 는 빼고) */
function staticClosure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importSpecs(readFileSync(path.join(dist, file), "utf8"))) {
      if (spec.startsWith(".")) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
    }
  }
  return seen;
}

/** 정적 import·export from 의 대상 (동적 import 는 빼고) */
function importSpecs(src) {
  return [...src.matchAll(/^(?:import|export)\b[^;]*?from\s*["']([^"']+)["']|^import\s*["']([^"']+)["']/gm)].map((m) => m[1] ?? m[2]);
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
