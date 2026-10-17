import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { FakeDevice } from "@/device";
import { renderWithHost } from "@/host/testHost";
import type { AppInput } from "@/track/appCheck";
import type { LoadedChapter } from "@/track/content";
import { StepSchema, type StepOf } from "@/track/schema";
import { AppStep } from "./AppStep";
import { APP_FILE_NAME, saveAppToBoard } from "./appUpload";

/*
 * 앱 단계 화면을 서버 렌더로 그려 본다 (testing-library 없이). 상호작용은 순수 함수 테스트(src/track/appCheck.test.ts)가 맡는다.
 * 단계는 테스트 안에서만 만든다 (content/chapters 에 넣지 않는다).
 */

const step = StepSchema.parse({
  type: "app",
  id: "app",
  title: "폰 앱 만들기",
  api: [
    { path: "/data", method: "읽기", fields: ["temp", "hum"], note: "2초마다 읽기" },
    { path: "/cmd?led=on", method: "명령", note: "LED 켜기" },
  ],
  design: { show: ["온도", "습도"], buttons: ["LED 켜기"], changes: [] },
  promptTemplate: "ESP32 주소 {{ip}} 에서 {{data}} 를 읽어 {{show}} 을(를) 보여 주고, 버튼 {{buttons}} 을(를) 누르면 {{commands}} 를 요청하는 HTML 을 만들어 줘.",
  readcheck: [
    { kind: "choice", q: "값을 가져오는 줄에 쓰인 것은?", options: ["fetch", "print"], answer: 0 },
    { kind: "text", q: "버튼을 누르면 어느 줄이 요청을 보내나요?" },
  ],
}) as StepOf<"app">;

const chapter = { id: "test-app", files: {} } as unknown as LoadedChapter;
const GOOD = `<html><body><button onclick="fetch('/cmd?led=on')">켜기</button><script>fetch('/data')</script></body></html>`;

function render(input: AppInput, teacherMode = false) {
  return renderWithHost(createElement(AppStep, { step, chapter, input, onInput: () => {}, teacherMode, attempts: 0, onComplete: () => {} }));
}

describe("AppStep 화면", () => {
  it("처음: 설계 세 칸(보기 글), 약속표, ___ 가 남은 프롬프트(복사 꺼짐), 저장·읽기 체크는 잠김", () => {
    const html = render({});
    for (const label of ["보여 줄 값", "누를 버튼", "바뀌는 모습", "약속표", "프롬프트", "결과 붙여넣기"]) expect(html).toContain(label);
    expect(html).toContain("예:\n온도\n습도");
    expect(html).toContain("/cmd?led=on");
    expect(html).toContain("___ 을(를) 보여 주고");
    expect(html).toContain("보여 줄 값, 누를 버튼 칸을 채우면 복사할 수 있어요");
    expect(html).toContain('data-testid="app-board-locked"');
    expect(html).toContain('data-testid="app-readcheck-locked"');
    expect(html).not.toContain("<iframe");
  });

  it("설계를 채우면 프롬프트가 채워진다", () => {
    const html = render({ design: { show: "온도", buttons: "켜기" } });
    expect(html).toContain("/data(JSON: temp, hum) 를 읽어 온도 을(를) 보여 주고, 버튼 켜기");
    expect(html).not.toContain("칸을 채우면 복사할 수 있어요");
  });

  it("검사 실패: 실패 항목마다 되묻기, 잠김 그대로", () => {
    const bad = "<p>fetch('/data')</p>";
    const html = render({ html: bad, checkedHtml: bad });
    expect(html).toContain('data-testid="app-check"');
    expect(html).toContain('data-pass="false"');
    expect(html).toContain("버튼을 누르면 어느 주소로 요청을 보내나요?");
    expect(html).toContain('data-testid="app-readcheck-locked"');
  });

  it("검사 통과: 보드 저장(연결 전엔 꺼짐)·미리 보기 버튼과 읽기 체크가 열린다", () => {
    const html = render({ html: GOOD, checkedHtml: GOOD }, true);
    expect(html).toContain("검사를 모두 통과했어요");
    expect(html).not.toContain('data-pass="false"');
    expect(html).toContain("보드에 index.html 저장");
    expect(html).toContain("보드를 연결하면 저장할 수 있어요");
    expect(html).toContain("미리 보기");
    expect(html).toContain('data-testid="app-readcheck"');
    expect(html).toContain("정답(교사 모드): fetch");
  });

  it("검사 뒤 글을 고치면 다시 검사하라고 한다", () => {
    const html = render({ html: `${GOOD}x`, checkedHtml: GOOD });
    expect(html).toContain("글이 바뀌었어요. 다시 검사하세요");
    expect(html).not.toContain('data-testid="app-check"');
  });
});

describe("보드에 index.html 저장 (가짜 보드)", () => {
  it("saveAppToBoard 는 index.html 을 쓰고 보드를 다시 시작한다", async () => {
    const device = new FakeDevice();
    await device.connect();
    const log: string[] = [];
    await saveAppToBoard(device, GOOD, (t) => log.push(t));
    expect(device.files.get(APP_FILE_NAME)).toBe(GOOD);
    expect(log.at(-1)).toContain("다시 시작");
  });

  it("연결하지 않은 보드면 실패한다", async () => {
    await expect(saveAppToBoard(new FakeDevice(), GOOD)).rejects.toThrow();
  });
});
