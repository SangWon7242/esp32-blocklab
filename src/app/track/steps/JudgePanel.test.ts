import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JudgePanel } from "./JudgePanel";

/*
 * 판정 패널을 서버 렌더로 그려 본다 (testing-library 없이, AppStep.test 와 같은 방식).
 * 미션·디버깅 화면은 편집기(Blockly)를 품어 여기서는 패널만 본다. 주의를 모으는 쪽은 src/app/track/judgeNotes.test.ts.
 */

const NOTE = "반복 안에 기다리기가 없으면 보드가 바빠져요";

function render(props: Partial<Parameters<typeof JudgePanel>[0]>) {
  return renderToStaticMarkup(createElement(JudgePanel, { onJudge: () => {}, failures: null, passed: undefined, passText: "통과했어요. 아래 완료를 누르세요.", ...props }));
}

describe("JudgePanel 화면", () => {
  it("판정 전: 버튼만", () => {
    const html = render({});
    expect(html).toContain("판정");
    expect(html).not.toContain("judge-failures");
    expect(html).not.toContain("judge-notes");
  });

  it("실패: 되묻기 문장만, 주의는 없다", () => {
    const html = render({ passed: false, failures: ["if 줄이 있나요?"], notes: [NOTE] });
    expect(html).toContain('data-testid="judge-failures"');
    expect(html).toContain("아직이에요. 다시 생각해 보세요");
    expect(html).toContain("if 줄이 있나요?");
    expect(html).not.toContain("judge-notes");
    expect(html).not.toContain(NOTE);
  });

  it("통과 + 주의: 통과 문구와 함께 '주의 (통과에는 영향 없음)' 목록", () => {
    const html = render({ passed: true, notes: [NOTE, "buzzer 는 준비만 하고 쓰지 않았어요. 이 장치가 필요한가요?"] });
    expect(html).toContain("통과했어요. 아래 완료를 누르세요.");
    expect(html).toContain('data-testid="judge-notes"');
    expect(html).toContain("주의 (통과에는 영향 없음)");
    expect(html).toContain(`<li>${NOTE}</li>`);
    expect(html).toContain("<li>buzzer 는 준비만 하고 쓰지 않았어요. 이 장치가 필요한가요?</li>");
    expect(html).toContain("lucide-triangle-alert");
    expect(html).not.toContain("judge-failures");
  });

  it("통과 + 주의 없음: 주의 칸이 없다", () => {
    expect(render({ passed: true, notes: [] })).not.toContain("judge-notes");
    expect(render({ passed: true })).not.toContain("judge-notes");
  });
});
