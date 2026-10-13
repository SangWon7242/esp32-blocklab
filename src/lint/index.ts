import type { LineMap } from "@/codegen/linemap";
import { buildContext } from "./walk";
import type { Issue, Level, LintWorkspaceJson, Rule } from "./types";
import { noStart } from "./rules/noStart";
import { emptyInput } from "./rules/emptyInput";
import { deviceBeforeSetup } from "./rules/deviceBeforeSetup";
import { pinRule } from "./rules/pinRule";
import { valueRange } from "./rules/valueRange";
import { pinConflict } from "./rules/pinConflict";
import { loopWithoutSleep } from "./rules/loopWithoutSleep";
import { orphan } from "./rules/orphan";
import { undefinedVariable } from "./rules/undefinedVariable";
import { rawCode } from "./rules/rawCode";

export type { ConsoleEntry, Issue, Level, LintWorkspaceJson } from "./types";
export { blockLabel } from "./labels";
export { formatConsole } from "./format";
export { alignLines } from "./align";

export const RULES: Rule[] = [noStart, emptyInput, deviceBeforeSetup, pinRule, valueRange, pinConflict, loopWithoutSleep, orphan, undefinedVariable, rawCode];

const LEVEL_RANK: Record<Level, number> = { error: 0, warning: 1, info: 2 };

/**
 * 작업판 JSON(+ 코드 지도)을 검사한다. 오류 → 주의 → 정보, 같은 수준은 줄 번호 순(줄을 모르면 뒤로).
 * Blockly·React 에 기대지 않는 순수 함수.
 */
export function lint(json: LintWorkspaceJson, map: LineMap | null): Issue[] {
  const ctx = buildContext(json, map);
  const issues = RULES.flatMap((rule) => rule(ctx));
  const line = (i: Issue) => i.line ?? Number.POSITIVE_INFINITY;
  return issues
    .map((issue, order) => ({ issue, order }))
    .sort((a, b) => LEVEL_RANK[a.issue.level] - LEVEL_RANK[b.issue.level] || line(a.issue) - line(b.issue) || a.order - b.order)
    .map((x) => x.issue);
}
