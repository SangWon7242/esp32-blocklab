#!/usr/bin/env node
/*
 * dist-lib/index.js 연기 검사 (npm run test:lib, build:lib 끝에도 돈다).
 * 허브 서버(Node, window 없음)가 index.js 를 import 해 순수 API(loadChapters·judge·codeToBlocks)를 쓸 수 있어야 한다.
 * 화면(Blockly·CodeMirror)은 lazy 조각이라 import 때 끌려오지 않아야 한다.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

for (const name of ["ChapterReviewView", "ProjectPreview", "CodeView", "SubmitCard", "SubmitCardView", "canSubmitChapter", "chapterSnapshot", "textAnswersOf", "judgeSnapshot", "loadBlockTools", "BlocklabProvider", "useHost", "TrackListView", "ChapterView", "StepView", "LabView", "loadChapters", "getChapter", "judge", "codeToBlocks", "stepStates", "allSteps", "LocalProgressStore", "reflectMessage", "debugMessage", "parseReview"]) {
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

// import 뒤에도 DOM 흔적이 없어야 한다
assert.equal(typeof globalThis.window, "undefined");
assert.equal(typeof globalThis.document, "undefined");

// 선언 파일·CSS 가 함께 있다
assert.ok(existsSync(path.join(dist, "index.d.ts")));
assert.ok(existsSync(path.join(dist, "style.css")));
const css = readFileSync(path.join(dist, "style.css"), "utf8");
assert.ok(css.includes(".blocklab"), "style.css 에 .blocklab 범위가 없어요");
assert.ok(!/(^|[}{;,])(html|body|:root|:host)[\s,{]/.test(css), "style.css 에 범위 밖 루트 선택자가 있어요");
assert.ok(css.includes("var(--host-primary"), "호스트 토큰 상속(--host-primary)이 없어요");

console.log(
  `dist-lib 연기 검사 통과: v${lib.LIB_VERSION}, 챕터 ${chapters.length}개, 01-led 미션 판정 ${verdict.pass ? "통과" : `실패(${verdict.failures.length})`}, ` +
    `judgeSnapshot ${summary.passed}/${summary.missions}, 정적 조각 ${reached.size}개`,
);

/** index.js 에서 정적 import 로 닿는 dist-lib 안 파일들 (동적 import 는 빼고) */
function staticClosure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(path.join(dist, file), "utf8");
    for (const m of src.matchAll(/^import\b[^;]*?from\s*["']([^"']+)["']|^import\s*["']([^"']+)["']/gm)) {
      const spec = m[1] ?? m[2];
      if (spec.startsWith(".")) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
    }
  }
  return seen;
}
