import type { Rule } from "../types";

/** 시작 블록이 없으면 아무것도 실행되지 않는다 */
export const noStart: Rule = (ctx) =>
  ctx.blocks.some((b) => b.type === "start_program")
    ? []
    : [{ id: "no-start", level: "error", line: 1, ko: "프로그램이 시작되면 블록이 없어요", en: 'Error: no "프로그램이 시작되면" block' }];
