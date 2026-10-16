import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderWithHost } from "@/host/testHost";
import { JudgePanel } from "./JudgePanel";

/*
 * 판정 패널을 서버 렌더로 그려 본다 (testing-library 없이, AppStep.test 와 같은 방식).
 * 미션·디버깅 화면은 편집기(Blockly)를 품어 여기서는 패널만 본다. 주의를 모으는 쪽은 src/app/track/judgeNotes.test.ts.
 */

const NOTE = "반복 안에 기다리기가 없으면 보드가 바빠져요";

function render(props: Partial<Parameters<typeof JudgePanel>[0]>, mode: "student" | "review" = "student") {
  return renderWithHost(createElement(JudgePanel, { onJudge: () => {}, failures: null, passed: undefined, passText: "통과했어요. 아래 완료를 누르세요.", ...props }), { mode });
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

describe("JudgePanel — 1분 설명 관문", () => {
  const GATE = "통과했어요. 선생님께 1분 설명을 하고 확인을 받아요";
  const gate = (teacherMode: boolean, explained: boolean) => ({ teacherMode, explained, onConfirm: () => {} });

  it("관문이 없으면(설정 꺼짐) 통과 문구 그대로, 확인 배지·버튼 없음", () => {
    const html = render({ passed: true });
    expect(html).toContain("통과했어요. 아래 완료를 누르세요.");
    expect(html).not.toContain(GATE);
    expect(html).not.toContain("explain-gate");
    expect(html).not.toContain("설명 확인");
  });

  it("학생(교사 모드 아님): 통과 문구가 관문 문구로 바뀌고 '선생님 확인 대기' 배지만 보인다", () => {
    const html = render({ passed: true, explainGate: gate(false, false) });
    expect(html).toContain(GATE);
    expect(html).not.toContain("아래 완료를 누르세요");
    expect(html).toContain('data-testid="explain-gate"');
    expect(html).toContain("선생님 확인 대기");
    expect(html).toContain("lucide-hourglass");
    expect(html).not.toContain("설명 확인");
    expect(html).not.toContain("lucide-badge-check");
  });

  it("교사 모드: '설명 확인' 버튼(BadgeCheck)이 보이고 대기 배지는 없다", () => {
    const html = render({ passed: true, explainGate: gate(true, false) });
    expect(html).toContain(GATE);
    expect(html).toContain("설명 확인");
    expect(html).toContain("lucide-badge-check");
    expect(html).not.toContain("선생님 확인 대기");
  });

  it("확인을 받은 뒤: 원래 통과 문구 + '선생님 확인 완료' 배지, 버튼·대기 배지 없음", () => {
    const html = render({ passed: true, explainGate: gate(true, true) });
    expect(html).toContain("통과했어요. 아래 완료를 누르세요.");
    expect(html).not.toContain(GATE);
    expect(html).toContain('data-testid="explain-confirmed"');
    expect(html).toContain("선생님 확인 완료");
    expect(html).not.toContain("설명 확인</button>");
    expect(html).not.toContain("선생님 확인 대기");
  });

  it("통과하지 않았으면 관문이 있어도 아무것도 보이지 않는다", () => {
    const html = render({ passed: false, failures: ["if 줄이 있나요?"], explainGate: gate(true, false) });
    expect(html).not.toContain(GATE);
    expect(html).not.toContain("explain-gate");
    expect(html).not.toContain("설명 확인");
    expect(html).toContain('data-testid="judge-failures"');
  });

  it("통과 + 관문 + 주의: 관문 문구와 주의 목록이 함께 보인다", () => {
    const html = render({ passed: true, explainGate: gate(false, false), notes: [NOTE] });
    expect(html).toContain(GATE);
    expect(html).toContain("선생님 확인 대기");
    expect(html).toContain('data-testid="judge-notes"');
    expect(html).toContain(`<li>${NOTE}</li>`);
  });
});

describe("JudgePanel 열람 모드", () => {
  it("판정·설명 확인 버튼은 숨고 마지막 결과만 보인다", () => {
    const html = render({ passed: true, explainGate: { teacherMode: true, explained: false, onConfirm: () => {} }, notes: [NOTE] }, "review");
    expect(html).not.toContain("판정</button>");
    expect(html).not.toContain("설명 확인</button>");
    expect(html).toContain("선생님께 1분 설명을 하고 확인을 받아요");
    expect(html).toContain('data-testid="judge-notes"');
  });
});
