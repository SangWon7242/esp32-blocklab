import { findSetupByBlock } from "@/devices/registry";
import { definedNames } from "@/parser/codeNames";
import { blockValues } from "../device";
import { issueAt, realBlocks } from "../walk";
import type { Rule } from "../types";

/** 변수 칸(VAR)의 변수에 값을 정하는 블록: 정하기, 리스트 만들기, 반복 변수를 쓰는 반복 */
const DEFINES_VAR = new Set(["variables_set", "list_create", "list_create_from", "flow_for_each", "flow_for_range", "flow_for_range_step"]);

/** 변수 칸(VAR)의 변수를 읽는 블록: 변수 값, 만큼 바꾸기(x += 1 은 x 를 읽는다), 리스트를 고치거나 읽는 블록 */
const READS_VAR = new Set([
  "variables_get", "var_change",
  "list_append", "list_insert", "list_remove_at", "list_remove_value", "list_clear", "list_set", "list_index",
]);

/**
 * 값을 정한 적 없는 변수 읽기. 정한 것으로 치는 것: 어디든 그 변수의 variables_set·리스트 만들기, for 반복 변수
 * (각 항목 반복·범위 반복·걸음 반복), 함수 매개변수, 준비 블록의 변수 칸, n번 반복이 있을 때의 i, 코드 블록(code_stmt) 원문이
 * 정하는 이름(`a, b = 0, 0`·`x = y = 0`·for·with … as·global·import, codeNames.ts). 읽는 것: 변수 값 블록,
 * 만큼 바꾸기, 리스트 블록(추가·끼우기·지우기·비우기·정하기·위치). 변수는 이름으로 맞춘다 (파이썬도 이름으로 찾는다).
 * 전역 변수 쓰기(var_global, global x)는 이름을 알리기만 하므로 정하는 것도 읽는 것도 아니다.
 */
export const undefinedVariable: Rule = (ctx) => {
  const blocks = realBlocks(ctx);
  const defined = new Set<string>();
  const add = (n: string | undefined) => n && defined.add(n);
  for (const b of blocks) {
    if (DEFINES_VAR.has(b.type)) add(ctx.varName(b.fields.VAR));
    else if (b.type === "flow_repeat_n") add("i");
    else if (b.type === "code_stmt") definedNames(String(b.fields.CODE ?? "")).forEach(add);
    else if (b.type === "procedures_defnoreturn" || b.type === "procedures_defreturn") {
      const params = (b.extraState as { params?: unknown } | undefined)?.params;
      if (Array.isArray(params)) for (const p of params) add(ctx.varName(p));
    } else {
      const setup = findSetupByBlock(b.type);
      if (!setup) continue;
      // 준비가 만드는 이름만 (변수 핀 준비의 핀 번호 칸 PINVAR 는 읽는 변수다)
      const values = blockValues(ctx, b, setup.parts);
      const provided = new Set(setup.provides(values));
      for (const part of setup.parts) if (part.kind === "var" && provided.has(values[part.name])) add(values[part.name]);
    }
  }
  return blocks.flatMap((b) => {
    if (!READS_VAR.has(b.type)) return [];
    const name = ctx.varName(b.fields.VAR);
    return name && !defined.has(name)
      ? [issueAt(ctx, b, "undefined-variable", "warning", `${name} 는 아직 값을 정하지 않았어요`, `NameError: name '${name}' may be undefined`)]
      : [];
  });
};
