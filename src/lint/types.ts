import type { LineMap } from "@/codegen/linemap";

/** 문제의 수준: 오류 → 주의 → 정보 순으로 보여 준다 */
export type Level = "error" | "warning" | "info";

/**
 * 검사 결과 하나. ko 는 블록 말풍선·문제 패널(학생용 한글), en 은 콘솔(파이썬 모양 영어).
 * line 은 코드 지도의 그 블록 첫 줄(값 블록이면 그 블록을 담은 가장 가까운 명령 블록의 첫 줄, 1부터).
 */
export type Issue = { id: string /* 규칙 id */; level: Level; blockId?: string; line?: number; ko: string; en: string };

/** 콘솔 한 항목. text 는 영어(여러 줄일 수 있다) */
export type ConsoleEntry = { level: Level; text: string; line?: number; blockId?: string };

/** 작업판 JSON 의 블록 (Blockly.serialization 꼴; 파서 JSON 과 같고 살아 있는 작업판 JSON 에는 id 가 있다) */
export type BlockJson = {
  type: string;
  id?: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockJson; shadow?: BlockJson }>;
  next?: { block?: BlockJson };
  extraState?: unknown;
};

/** 검사가 읽는 작업판 JSON (Blockly 의 WorkspaceJson 을 그대로 받는다) */
export type LintWorkspaceJson = {
  variables?: { id: string; name: string }[];
  blocks?: { blocks?: BlockJson[] };
};

/** 평탄화한 블록 하나 (walk.ts) */
export type FlatBlock = {
  /** JSON 의 id. 없으면(파서 JSON) 지어낸 "_n" 이고 hasId 가 거짓 */
  id: string;
  hasId: boolean;
  type: string;
  fields: Record<string, unknown>;
  /** 입력 이름 → 끼워진 블록 id / 그림자 id */
  inputs: Record<string, { block?: string; shadow?: string }>;
  extraState: unknown;
  /** 이 블록을 입력으로 담은 블록 (next 로 이어진 블록도 그 줄의 머리가 담긴 블록). 최상위 줄이면 null */
  parentId: string | null;
  /** parentId 의 어느 입력에 담겼는지 */
  inputName: string | null;
  /** next 로 이어진 다음 블록 */
  nextId: string | null;
  /** 작업판 최상위 블록(줄의 머리)인지 */
  topLevel: boolean;
  /** 그림자 블록인지 */
  shadow: boolean;
};

export type LintContext = {
  /** 작업판의 모든 블록 (최상위 순서, 그 안은 깊이 우선 — 위에서 아래로 놓인 순서) */
  blocks: FlatBlock[];
  byId: Map<string, FlatBlock>;
  /** 변수 칸 값({id, name?} 또는 이름 글)을 변수 이름으로 */
  varName: (field: unknown) => string | undefined;
  map: LineMap | null;
};

export type Rule = (ctx: LintContext) => Issue[];
