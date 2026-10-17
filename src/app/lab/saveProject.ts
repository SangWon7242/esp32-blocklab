import type { HostProps } from "@/host/HostContext";

/*
 * 「작품으로 저장」(lib-v1.0.3): 자유 코딩·트랙 편집기 단계가 함께 쓰는 순수 부분 — 제목 검사, 기본 제목, 저장 한 번.
 * 저장 자체(새 작품 POST / 같은 작품 PATCH)는 호스트 onSaveProject 가 고른다. 성공·실패 토스트도 호스트 몫이고
 * 라이브러리는 대화상자 안·단추 옆 문구만 보여 준다(토스트가 두 번 뜨지 않게).
 */

/** 허브 작품 API 와 같은 상한 (글자 단위 — 한글 한 자도 한 자) */
export const PROJECT_TITLE_MAX = 60;

export const SAVE_PROJECT_TEXT = {
  button: "작품으로 저장",
  tip: "지금 프로그램을 내 작품에 남겨요",
  dialogTitle: "작품으로 저장",
  dialogDescription: "제목을 정하면 지금 블록과 코드가 내 작품에 남아요.",
  label: "제목",
  save: "저장",
  saving: "저장 중",
  cancel: "취소",
  saved: "작품으로 저장했어요",
  failed: "저장하지 못했어요. 잠시 뒤 다시 해 보세요.",
  emptyTitle: "제목을 한 글자 이상 써 주세요.",
  longTitle: `제목은 ${PROJECT_TITLE_MAX}자까지 쓸 수 있어요.`,
  labPrefix: "자유 코딩",
  codeOnly: "블록으로 바꿀 수 없는 줄이 있어 코드 글로 저장해요.",
} as const;

export type SaveProjectStatus = "idle" | "saving" | "saved" | "failed";
export type SaveProjectInput = Parameters<NonNullable<HostProps["onSaveProject"]>>[0];
/**
 * 저장을 누른 순간의 프로그램 (편집기 핸들의 getSaveProgram). unconvertible 이면 코드 모드 문법 오류로
 * blocksJson 없이 코드 글만 저장한다 — 대화상자가 그 안내를 보인다 (lib-v1.0.4)
 */
export type SaveProjectProgram = { code: string; blocksJson: unknown; unconvertible?: boolean };

/** 글자 수 (서로게이트 쌍도 한 자) */
export function titleLength(title: string): number {
  return [...title].length;
}

/** 줄바꿈·연속 빈칸을 한 칸으로 줄이고 앞뒤를 덜어 낸다 (허브 cleanTitle 과 같은 규칙) */
export function tidyTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** 제목 검사: 다듬은 제목이 1~60자면 그 제목, 아니면 까닭 */
export function checkProjectTitle(raw: string): { ok: true; title: string } | { ok: false; reason: "empty" | "long" } {
  const title = tidyTitle(raw);
  const n = titleLength(title);
  if (n === 0) return { ok: false, reason: "empty" };
  if (n > PROJECT_TITLE_MAX) return { ok: false, reason: "long" };
  return { ok: true, title };
}

/** 기본 제목이 60자를 넘으면 잘라 둔다 (학생이 고칠 수 있게 대화상자에 미리 채우는 값) */
export function fitTitle(raw: string): string {
  const title = tidyTitle(raw);
  return [...title].slice(0, PROJECT_TITLE_MAX).join("").trimEnd();
}

/** 자유 코딩의 기본 제목: "자유 코딩 2026-10-17" (그 컴퓨터의 날짜) */
export function labDefaultTitle(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${SAVE_PROJECT_TEXT.labPrefix} ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 트랙 편집기 단계의 기본 제목: "<챕터 제목> — <단계 제목>" (60자로 자름) */
export function stepDefaultTitle(chapterTitle: string, stepTitle: string): string {
  return fitTitle(`${chapterTitle} — ${stepTitle}`);
}

/**
 * 저장 한 번. 호스트가 throw 하면(허브는 토스트를 띄운 뒤 다시 throw) failed.
 * blocksJson 이 없으면 null 로 보낸다 (코드만 있는 작품)
 */
export async function runSaveProject(onSave: NonNullable<HostProps["onSaveProject"]>, input: SaveProjectInput): Promise<"saved" | "failed"> {
  try {
    const payload: SaveProjectInput = { title: input.title, code: input.code, blocksJson: input.blocksJson ?? null };
    if (input.chapterId) payload.chapterId = input.chapterId;
    await onSave(payload);
    return "saved";
  } catch {
    return "failed";
  }
}
