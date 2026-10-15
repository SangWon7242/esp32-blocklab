import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  APP_DEFAULT_MAX_BYTES, appCheckLabels, appCheckOptions, appCheckPassed, appCompleted, checkAppStep, externalUrls, fillPrompt,
  gradeAppReadCheck, PROMPT_BLANK, stripCodeFence, type AppInput,
} from "./appCheck";
import { canComplete } from "./completion";
import { StepSchema, type StepOf } from "./schema";

/** 테스트 안에서만 쓰는 app 단계 (content/chapters 에는 넣지 않는다) */
const STEP_YAML = `
type: app
id: app
title: 폰 앱 만들기
minutes: 20
api:
  - { path: "/data", method: "읽기", fields: ["temp", "hum"], note: "2초마다 읽기" }
  - { path: "/cmd?led=on", method: "명령", note: "LED 켜기" }
  - { path: "/cmd?led=off", method: "명령", note: "LED 끄기" }
design:
  show: ["온도", "습도"]
  buttons: ["LED 켜기", "LED 끄기"]
  changes: ["온도 28 넘으면 빨강"]
promptTemplate: |
  ESP32 주소 {{ip}} 에서 {{data}} 를 2초마다 읽어 {{show}} 을(를) 보여 주고,
  버튼 {{buttons}} 을(를) 누르면 {{commands}} 를 요청하는 한 파일짜리 HTML 을 만들어 줘.
  외부 라이브러리·외부 스크립트 없이, 폰 화면에 맞게.
checks:
  maxBytes: 2000
  mustUse: ["led=on"]
readcheck:
  - { kind: choice, q: "값을 가져오는 줄에 쓰인 것은?", options: ["fetch", "print", "import"], answer: 0, hint: "주소에 요청을 보내는 함수" }
  - { kind: text, q: "버튼을 누르면 어느 줄이 보드에 요청을 보내나요?" }
`;

function parseStep(yaml: string = STEP_YAML) {
  return StepSchema.parse(parse(yaml)) as StepOf<"app">;
}

const GOOD = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width"><style>body{font-family:sans-serif}</style></head>
<body><p id="t">--</p><button onclick="fetch('/cmd?led=on')">LED 켜기</button><button onclick="fetch('/cmd?led=off')">LED 끄기</button>
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>
<script>setInterval(async () => { const d = await (await fetch('/data')).json(); t.textContent = d.temp; }, 2000);</script>
</body></html>`;

const failedIds = (step: StepOf<"app">, html: string) => checkAppStep(step, html).filter((c) => !c.pass).map((c) => c.id);

describe("app 단계 스키마", () => {
  it("예시 단계를 읽는다 (design 칸은 비워도 되고, checks 는 선택)", () => {
    const step = parseStep();
    expect(step.api).toHaveLength(3);
    expect(step.readcheck[1].kind).toBe("text");
    const bare = parseStep(STEP_YAML.replace(/checks:\n(?: {2}.*\n)+/, "").replace(/design:\n(?: {2}.*\n)+/, "design: { show: [온도] }\n"));
    expect(bare.checks).toBeUndefined();
    expect(bare.design).toEqual({ show: ["온도"], buttons: [], changes: [] });
  });

  it("틀린 것: 없는 빈칸 이름, / 로 시작하지 않는 주소, 모르는 키, 범위 밖 답, 4문항", () => {
    const bad = (y: string) => StepSchema.safeParse(parse(y)).success;
    expect(bad(STEP_YAML.replace("{{show}}", "{{shw}}"))).toBe(false);
    expect(bad(STEP_YAML.replace('path: "/data"', 'path: "data"'))).toBe(false);
    expect(bad(STEP_YAML.replace('method: "읽기"', 'method: "GET"'))).toBe(false);
    expect(bad(STEP_YAML.replace("maxBytes: 2000", "maxByte: 2000"))).toBe(false);
    expect(bad(STEP_YAML.replace("answer: 0", "answer: 3"))).toBe(false);
    expect(bad(`${STEP_YAML}  - { kind: text, q: a }\n  - { kind: text, q: b }\n`)).toBe(false);
    expect(bad(STEP_YAML)).toBe(true);
  });
});

describe("fillPrompt", () => {
  const step = parseStep();
  it("약속표·학생 설계로 빈칸을 채운다 (상대 주소, 읽기 주소의 값, 명령 주소의 설명)", () => {
    const r = fillPrompt(step.promptTemplate, step.api, { show: "온도\n습도\n", buttons: "켜기\n 끄기 ", changes: "" });
    expect(r.missing).toEqual([]);
    expect(r.text).toContain("이 페이지를 내준 보드(상대 주소)");
    expect(r.text).toContain("/data(JSON: temp, hum) 를 2초마다");
    expect(r.text).toContain("온도, 습도 을(를)");
    expect(r.text).toContain("버튼 켜기, 끄기");
    expect(r.text).toContain("/cmd?led=on(LED 켜기), /cmd?led=off(LED 끄기)");
    expect(r.text).not.toMatch(/\{\{|\n$/);
  });
  it("템플릿이 쓰는 학생 칸이 비면 ___ 와 missing (쓰지 않는 칸은 비어도 된다)", () => {
    const r = fillPrompt(step.promptTemplate, step.api, { show: "  \n" });
    expect(r.missing).toEqual(["show", "buttons"]);
    expect(r.text).toContain(`${PROMPT_BLANK} 을(를) 보여 주고`);
  });
});

describe("붙여넣기 검사", () => {
  const step = parseStep();
  it("기본값: 크기 12000, 약속표 주소의 경로(중복 없이) + 챕터 mustUse", () => {
    expect(appCheckOptions({ api: step.api, checks: undefined })).toEqual({ maxBytes: APP_DEFAULT_MAX_BYTES, mustUse: ["/data", "/cmd"] });
    expect(appCheckOptions(step)).toEqual({ maxBytes: 2000, mustUse: ["/data", "/cmd", "led=on"] });
    expect(appCheckLabels(appCheckOptions(step))).toContain("약속 주소 `/cmd` 쓰기");
  });

  it("좋은 HTML 은 모두 통과 (xmlns 이름표 주소는 바깥 주소가 아니다)", () => {
    expect(failedIds(step, GOOD)).toEqual([]);
    // AI 답을 ``` 울타리째 붙여도 된다
    expect(failedIds(step, "```html\n" + GOOD + "\n```")).toEqual([]);
    expect(stripCodeFence("```html\n<html></html>\n```")).toBe("<html></html>");
  });

  it("한 파일: <html 이 없으면 실패", () => {
    expect(failedIds(step, GOOD.replace(/<\/?html>/g, ""))).toEqual(["one-file"]);
  });

  it("<script src=…> 는 상대 주소여도 실패 (보드에는 index.html 하나)", () => {
    expect(failedIds(step, GOOD.replace("<script>", '<script src="app.js"></script><script>'))).toEqual(["no-script-src"]);
  });

  it("<link href=바깥 주소> 와 바깥 주소는 실패, 실패 문장에 그 주소", () => {
    const html = GOOD.replace("<style>", '<link rel="stylesheet" href="https://cdn.example.com/x.css"><style>');
    expect(failedIds(step, html)).toEqual(["no-external-link", "relative-only"]);
    expect(checkAppStep(step, html).find((c) => c.id === "relative-only")!.fail).toContain("https://cdn.example.com/x.css");
    expect(failedIds(step, GOOD.replace("<style>", '<link rel="stylesheet" href="//cdn.example.com/x.css"><style>'))).toEqual(["no-external-link", "relative-only"]);
  });

  it("ESP32 IP 를 박은 절대 주소도 실패 (상대 주소만)", () => {
    expect(failedIds(step, GOOD.replace("fetch('/data')", "fetch('http://192.168.4.1/data')"))).toEqual(["relative-only"]);
    expect(externalUrls('<img src="//x.io/a.png"> https://a.b/c "http://www.w3.org/2000/svg"')).toEqual(["https://a.b/c", "//x.io/a.png"]);
  });

  it("약속 주소를 쓰지 않으면 주소마다 되묻기 (읽기·명령·챕터 덧붙임)", () => {
    const html = GOOD.replace("fetch('/data')", "fetch('/values')").replace(/\/cmd\?led=on/g, "/set?x=1").replace(/\/cmd\?led=off/g, "/set?x=0");
    const checks = checkAppStep(step, html);
    expect(checks.filter((c) => !c.pass).map((c) => c.id)).toEqual(["must-use:/data", "must-use:/cmd", "must-use:led=on"]);
    expect(checks.find((c) => c.id === "must-use:/data")!.fail).toContain("어느 주소에서 값을 가져오나요");
    expect(checks.find((c) => c.id === "must-use:/cmd")!.fail).toContain("버튼을 누르면");
    expect(checks.find((c) => c.id === "must-use:led=on")!.fail).toContain("약속표와 다시 맞춰");
  });

  it("크기: UTF-8 바이트가 maxBytes 를 넘으면 실패", () => {
    const html = GOOD.replace("<p id", `<p>${"가".repeat(700)}</p><p id`);
    expect(failedIds(step, html)).toEqual(["size"]);
    expect(checkAppStep(step, html).find((c) => c.id === "size")!.fail).toMatch(/지금 \d+ 바이트/);
  });

  it("<iframe·eval( 은 실패", () => {
    expect(failedIds(step, GOOD.replace("<p id", '<iframe srcdoc="x"></iframe><p id'))).toEqual(["no-iframe"]);
    expect(failedIds(step, GOOD.replace("d.temp;", "eval ('d.temp');"))).toEqual(["no-eval"]);
  });

  it("실패 항목에만 되묻기 문장이 있다", () => {
    for (const c of checkAppStep(step, "")) expect(Boolean(c.fail)).toBe(!c.pass);
  });
});

describe("app 완료 조건", () => {
  const step = parseStep();
  const done: AppInput = { html: GOOD, checkedHtml: GOOD, answers: ["0", "fetch 줄"], results: [true, true] };
  it("검사 통과 + 읽기 체크 통과면 완료 (보드 저장은 선택)", () => {
    expect(appCompleted(step, done)).toBe(true);
    expect(canComplete(step, done)).toBe(true);
  });
  it("검사 뒤 글을 고치면 다시 검사해야 한다", () => {
    expect(appCheckPassed(step, { ...done, html: `${GOOD} ` })).toBe(false);
    expect(canComplete(step, { ...done, html: `${GOOD} ` })).toBe(false);
  });
  it("검사 실패·검사 안 함·읽기 체크 미통과면 완료 못 함", () => {
    const bad = GOOD.replace("<html>", "<html><iframe></iframe>");
    expect(canComplete(step, { ...done, html: bad, checkedHtml: bad })).toBe(false);
    expect(canComplete(step, { ...done, checkedHtml: undefined })).toBe(false);
    expect(canComplete(step, { ...done, results: [true, null] })).toBe(false);
  });
  it("읽기 체크: choice 는 번호, text 는 쓰면 통과", () => {
    expect(gradeAppReadCheck(step.readcheck, ["0", "답"])).toEqual([true, true]);
    expect(gradeAppReadCheck(step.readcheck, ["1", "  "])).toEqual([false, false]);
    expect(gradeAppReadCheck(step.readcheck, [undefined, undefined])).toEqual([false, false]);
  });
});
