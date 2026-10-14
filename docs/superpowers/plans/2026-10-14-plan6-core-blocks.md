# ESP32 블록랩 — 계획 6: 판단·계산·변수·리스트 블록 확장 (엔트리·스크래치 수준)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 엔트리·스크래치처럼 판단(사이·포함), 계산(무작위·반올림·최대최소·거듭제곱·길이·n번째·지난 시간), 변수(만큼 바꾸기), 리스트(만들기·추가·끼우기·지우기·정하기·항목·길이·위치·각 항목 반복), 흐름(범위 반복·멈추기·건너뛰기) 블록을 더한다. 모든 블록은 양방향(블록→MicroPython, 코드→블록)이어야 하고 블록 사전에 설명·예시가 있어야 한다.

**Architecture:** 블록 정의는 `src/blocks/definitions/{judge,calc,data,flow}.ts`(Blockly JSON), 생성기는 `src/codegen/forBlock.ts`(+ `src/codegen/imports.ts` 의 import 규칙 `random`·`math`·`time`), 파서는 `src/parser/expressions.ts`(식)·`statements.ts`(문)에 분기 추가. 리스트는 새 카테고리 "리스트"(아이콘 lucide `List`, 색은 `CATEGORY_COLORS.list`, 장치 색 배치 테스트가 다른 색과 ΔE≥0.06 을 요구하므로 통과하는 값을 고른다). 변수 카테고리는 Blockly 의 VARIABLE 플라이아웃 콜백을 감싸 `var_change` 블록을 끼워 넣는다. 블록 사전 내용은 `src/docs/content/core.ts`(+ `data.ts`).

**Tech Stack:** 기존과 같음(Blockly 13.3, @lezer/python 파서, Vitest, Playwright).

**Spec:** 이 문서. 기준 문서 `docs/superpowers/specs/2026-10-13-esp32-blocklab-design.md`(양방향 변환 원칙, 코드 스타일: 4칸 들여쓰기·큰따옴표).

## Global Constraints

- 양방향: 모든 새 블록은 `생성 → 파싱 → 생성` 이 같은 코드를 내야 한다(`src/parser/roundtrip.test.ts` 꼴의 테스트를 블록마다 둔다). 파싱이 안 되는 꼴은 전처럼 `code_stmt`/`code_expr` 로 남긴다.
- 파이썬 인덱스는 0부터다. 블록 문구에 "(0부터)" 를 적어 학생이 헷갈리지 않게 한다. 엔트리식 1부터를 흉내 내려고 `-1` 을 끼워 넣지 않는다(코드 읽기 교육 목적).
- lucide 아이콘·shadcn 만, 이모지 금지, 한국어 학생 문구, 영어 식별자. 블록 사전: 모든 새 블록에 `concept`(2~4문장)·`example`(블록으로 되돌아가는 코드)·`tips`.
- 검사(`src/lint`): 새 변수 칸(VAR)은 기존 변수 이름 규칙(예약어·파이썬 이름)을 그대로 받는다. 정의되지 않은 이름 검사가 `for` 반복 변수·리스트 변수를 정의로 본다.
- 커밋마다 `npm test`·`npx tsc -b --noEmit`·`npm run build`, 마지막 Task 에서 `npm run test:e2e`. 커밋 메시지 한국어 + `Co-Authored-By:` 줄.

## 사전 확인된 사실

- 지금 핵심 블록: 시작 `start_program`; 흐름 `flow_repeat_forever`(`while True:`), `flow_repeat_n`(`for i in range(n):`, 반복 변수가 `i` 일 때만 블록으로 돌아옴), `controls_whileUntil`, `controls_if`, `flow_wait`/`_ms`/`_us`; 판단 `logic_compare`(=,≠,<,≤,>,≥), `logic_operation`, `logic_negate`, `logic_boolean`; 계산 `math_number`, `text`, `calc_arith`(+,-,×,÷,//,%), `calc_concat`, `calc_str`, `calc_int`; 변수 `variables_set`/`variables_get`(Blockly 내장; `math_change` 는 `registerBlocks()` 가 지운다); 함수 `procedures_*`; 코드 `code_stmt`/`code_expr`.
- 파서(`src/parser`): `expressions.ts` `convertAny` 가 Number·String·Boolean·VariableName·UnaryExpression(not, -)·BinaryExpression(CompareOp→logic_compare, and/or→logic_operation, ArithOp→calc_arith/calc_concat)·CallExpression(str/int/함수 호출)·ParenthesizedExpression·MemberExpression(장치 값) 을 다루고 나머지는 `fallback` → `code_expr`. `5 < d < 15` 같은 연쇄 비교는 식 전체를 코드로 남긴다(줄 120). `statements.ts` `convertStatement` 가 ExpressionStatement(장치 명령·time.sleep·print·함수 호출)·AssignStatement(`variables_set`)·IfStatement·WhileStatement·ForStatement(range(n) 만)·FunctionDefinition·Import·Pass·Comment 를 다루고 나머지는 `code_stmt`. 장치 변수의 메서드 호출은 `devices.ts` 가 먼저 본다(`ctx.devices` 에 등록된 이름만).
- 생성기: `src/codegen/forBlock.ts` `registerForBlocks(gen)` 에 블록별 함수, `Order` 는 `blockly/python`. import 는 `src/codegen/imports.ts` 의 규칙(정규식 `when` → `line`, rank)으로 코드에 맞춰 붙인다(예: `time.sleep` → `import time`). `blockSnippet` 이 블록 사전에 쓰인다.
- 툴박스 `src/blocks/toolbox.ts`(카테고리 JSON, `icon` 키), 카테고리 색 `src/blocks/colors.ts` `CATEGORY_COLORS`, 아이콘 `src/blocks/icons.ts`, 테마 `src/blocks/theme.ts` 의 `blockStyles`(`logic_blocks`·`math_blocks`·`text_blocks`·`variable_blocks`·`loop_blocks`). 변수 카테고리는 `custom: "VARIABLE"`.
- 블록 사전 카탈로그 테스트(`src/docs/catalog.test.ts`)가 툴박스의 모든 블록에 내용을 요구하고 예시가 블록으로 되돌아가는지 본다(`src/docs/content/*.ts`).
- 타입 검사 fallback: `src/parser/expressions.ts` 의 `outputTypes`/`convertExpr(expect)` 가 기대 타입과 다른 블록을 `code_expr` 로 바꾼다 — 새 값 블록은 그 표(`OUTPUT_TYPES` 59~61줄)에 출력 타입을 등록한다.

## 블록 목록 (문구 · 코드 · 파싱 규칙)

### 판단 (`judge_*`, 스타일 `logic_blocks`)
| 블록 | 문구 | 코드 | 코드→블록 |
|---|---|---|---|
| `judge_between` | `%1 이(가) %2 부터 %3 사이인가` (A, LOW, HIGH; Number) | `LOW <= A <= HIGH` | 연쇄 비교가 `<=`, `<=` 두 개일 때만(줄 120 의 분기에서) |
| `judge_contains` | `%1 에 %2 이(가) 들어 있는가` (CONTAINER any, ITEM any) | `ITEM in CONTAINER` | BinaryExpression `in`; `not in` 은 `logic_negate(judge_contains)` |

### 계산 (`calc_*`, 스타일 `math_blocks`/`text_blocks`)
| 블록 | 문구 | 코드 | 코드→블록 |
|---|---|---|---|
| `calc_arith` 에 옵션 추가 | `^` → `POW` | `A ** B` (Order.EXPONENTIATION, 오른쪽 결합) | ArithOp `**` |
| `calc_random` | `%1 부터 %2 사이의 무작위 정수` | `random.randint(A, B)` + `import random` | `random.randint(a, b)` |
| `calc_round` | `%1 %2` (X, OP 드롭다운: 반올림 `ROUND`, 내림 `FLOOR`, 올림 `CEIL`, 절댓값 `ABS`, 제곱근 `SQRT`) | `round(X)`, `math.floor(X)`, `math.ceil(X)`, `abs(X)`, `math.sqrt(X)` (+ `import math` 필요 시) | 그 호출들(인자 1개) |
| `calc_minmax` | `%1 와(과) %2 중 %3` (A, B, OP: 큰 수 `MAX`, 작은 수 `MIN`) | `max(A, B)` / `min(A, B)` | max/min 인자 2개 |
| `calc_len` | `%1 의 길이` (X: String 또는 리스트) | `len(X)` | `len(x)` |
| `calc_item` | `%1 의 %2 번째 항목 (0부터)` (X any, INDEX Number) | `X[INDEX]` (Order.MEMBER) | Subscript(슬라이스 아님) |
| `calc_ticks` | `지금까지 지난 시간 (ms)` | `time.ticks_ms()` + `import time` | `time.ticks_ms()` |

### 변수 (`var_change`, 스타일 `variable_blocks`)
| 블록 | 문구 | 코드 | 코드→블록 |
|---|---|---|---|
| `var_change` | `%1 을(를) %2 만큼 바꾸기` (VAR field_variable, DELTA Number shadow 1) | `VAR += DELTA` | AugAssign `+=` (lezer: AssignStatement 안의 `UpdateOp`/`+=` 토큰 — 트리를 찍어 확인) |
변수 플라이아웃: `ws.registerToolboxCategoryCallback("VARIABLE", cb)` 에서 `Blockly.Variables.flyoutCategory(ws, false)` 결과(JSON)에 `variables_set` 다음에 `var_change` 를 끼운다(변수가 없을 때는 "변수 만들기" 버튼만).

### 리스트 (`list_*`, 새 카테고리 "리스트", 스타일 `list_blocks`; VAR 는 field_variable 기본 `items`)
| 블록 | 문구 | 코드 | 코드→블록 |
|---|---|---|---|
| `list_create` | `리스트 %1 만들기 (비어 있음)` | `VAR = []` | AssignStatement, 오른쪽 빈 ArrayExpression |
| `list_create_from` | `리스트 %1 을(를) %2 로 만들기` (ITEMS field_input, 기본 `1, 2, 3`) | `VAR = [ITEMS]` | AssignStatement, 오른쪽 ArrayExpression → ITEMS 는 대괄호 안 원문 |
| `list_append` | `%1 에 %2 추가하기` | `VAR.append(V)` | 장치 변수가 아닌 이름의 `.append(x)` |
| `list_insert` | `%1 의 %2 번째에 %3 끼워 넣기 (0부터)` | `VAR.insert(I, V)` | `.insert(i, x)` |
| `list_remove_at` | `%1 의 %2 번째 항목 지우기 (0부터)` | `VAR.pop(I)` | `.pop(i)` (문장일 때) |
| `list_remove_value` | `%1 에서 %2 지우기` | `VAR.remove(V)` | `.remove(x)` |
| `list_clear` | `%1 비우기` | `VAR.clear()` | `.clear()` |
| `list_set` | `%1 의 %2 번째 항목을 %3 로 정하기 (0부터)` | `VAR[I] = V` | AssignStatement 왼쪽이 Subscript |
| `list_index` | `%1 에서 %2 의 위치 (0부터)` (값) | `VAR.index(V)` | 식 속 `.index(x)` |
| 리스트 카테고리에 함께 보이는 공용 블록 | `calc_item`, `calc_len`, `judge_contains`, `flow_for_each` | | |

### 흐름 추가 (`flow_*`, 스타일 `loop_blocks`)
| 블록 | 문구 | 코드 | 코드→블록 |
|---|---|---|---|
| `flow_for_each` | `%1 의 각 항목을 %2 에 넣으며 반복` (LIST value, VAR field_variable 기본 `item`) + DO | `for VAR in LIST:` | ForStatement 의 iterable 이 `range(...)` 가 아닐 때 |
| `flow_for_range` | `%1 을(를) %2 부터 %3 전까지 바꾸며 반복` (VAR field_variable 기본 `i`, FROM, TO) + DO | `for VAR in range(FROM, TO):` | ForStatement range 인자 2개; `range(n)` 인데 변수가 `i` 가 아니면 `flow_for_range` FROM=0 |
| `flow_break` | `반복 멈추고 나가기` | `break` | BreakStatement |
| `flow_continue` | `다음 반복으로 건너뛰기` | `continue` | ContinueStatement |

---

### Task 1: 판단·계산 블록

**Files:** Create `src/blocks/definitions/judge.ts`; Modify `src/blocks/definitions/calc.ts`, `src/blocks/definitions/index.ts`(목록), `src/blocks/toolbox.ts`(판단·계산 카테고리), `src/codegen/forBlock.ts`, `src/codegen/imports.ts`(`random`·`math` 규칙), `src/parser/expressions.ts`(OUTPUT_TYPES + 분기), `src/lint`(새 값 블록의 타입 기대 — 기존 `type-check` 규칙이 블록 출력 타입을 어디서 읽는지 확인해 같은 표를 쓴다), 테스트 `src/blocks/blocks.test.ts`·`src/codegen/codegen.test.ts`·`src/parser/roundtrip.test.ts`(또는 새 `core-blocks.test.ts`).

- [ ] 블록 정의(위 표의 문구·필드·출력 타입). `judge_between`·`judge_contains` 출력 Boolean, `calc_random`·`calc_round`·`calc_minmax`·`calc_len`·`calc_ticks` 출력 Number, `calc_item` 출력 null(어떤 값이든).
- [ ] 생성기 + import 규칙(`random.` → `import random`, `math.` → `import math`, `time.ticks_ms` → 이미 `time` 규칙이 있으면 확인).
- [ ] 파서 분기(위 표). 연쇄 비교는 `LOW <= A <= HIGH` 꼴만 블록으로, 나머지는 전처럼 코드로.
- [ ] 테스트: 블록마다 "블록 → 코드 → 블록 → 같은 코드" 왕복, 파서가 잘못 잡지 않는 반례(`max(a, b, c)` 는 code_expr, `x[1:3]` 은 code_expr, `5 < d < 15` 는 code_expr).
- [ ] 커밋 "판단·계산 블록: 사이·포함·무작위·반올림 묶음·최대최소·거듭제곱·길이·n번째·지난 시간".

### Task 2: 변수 바꾸기 · 리스트 카테고리 · 흐름 추가

**Files:** Create `src/blocks/definitions/data.ts`, `src/blocks/variableFlyout.ts`; Modify `src/blocks/definitions/flow.ts`, `src/blocks/toolbox.ts`(리스트 카테고리 — 변수·함수 사이), `src/blocks/colors.ts`(`list` 색 + `DEVICE_CATEGORIES`/카테고리 목록이 쓰는 곳), `src/blocks/icons.ts`(`List`), `src/blocks/theme.ts`(`list_blocks`, `list_category`), `src/components/editor/BlocklyWorkspace.tsx`(VARIABLE 콜백 등록), `src/codegen/forBlock.ts`, `src/parser/statements.ts`·`expressions.ts`, `src/lint`(for 변수·리스트 변수 정의 인식, `var_change` 의 미정의 변수 검사), 테스트.

- [ ] 블록 정의·생성기·파서(위 표). 장치 변수(`ctx.devices`)의 메서드는 지금처럼 장치가 먼저 보고, 그 외 이름의 `.append/.insert/.pop/.remove/.clear/.index` 만 리스트 블록으로.
- [ ] 변수 플라이아웃 콜백: 변수가 하나 이상 있을 때 `variables_set` → `var_change` → `variables_get` 순.
- [ ] 리스트 카테고리 색: `CATEGORY_COLORS.list` 를 더하고 `src/devices/colours.test.ts` 의 "다른 카테고리 색과 ΔE≥0.06" 을 통과하는 값으로(예: `#8e24aa` 계열부터 시도; 테스트가 알려 준다). 카테고리 색 대비 테스트(타일 글자)도 통과.
- [ ] 테스트: 왕복(리스트 블록 전부, for_each, for_range, break/continue, var_change), 반례(`x -= 1` 은 code_stmt, 장치 변수 `oled.index(...)` 는 리스트 블록이 되지 않음), 검사(정의 안 된 리스트에 추가하면 기존 "정의되지 않은 이름" 규칙이 잡는지, `for item in items:` 뒤 `item` 사용은 오류가 아닌지).
- [ ] 커밋 "변수 만큼 바꾸기, 리스트 카테고리, 각 항목·범위 반복, 멈추기·건너뛰기".

### Task 3: 블록 사전 내용 · e2e · 배포

**Files:** Modify `src/docs/content/core.ts`(또는 새 `data.ts` + index), `e2e/lab.spec.ts` 또는 새 `e2e/core-blocks.spec.ts`.

- [ ] 모든 새 블록(판단 2, 계산 7(+POW 는 calc_arith 설명 갱신), 변수 1, 리스트 9, 흐름 4)에 `concept`·`example`·`tips`. 예시는 학생 수준(예: 리스트에 센서 값 5개 모아 평균 내기, 무작위 수로 주사위, 사이 판단으로 "적당한 거리" 등). 카탈로그 테스트 전부 통과.
- [ ] e2e: 코드 모드에 리스트 프로그램(`items = []`, `items.append(3)`, `for item in items:` `print(item)`)을 넣으면 블록 모드에 `list_create`·`list_append`·`flow_for_each` 블록이 생기고 코드가 그대로인지; 변수 카테고리 플라이아웃에 "만큼 바꾸기" 가 있는지; 리스트 카테고리 타일이 있는지.
- [ ] `npm run test:e2e`, 커밋 "블록 사전: 새 판단·계산·변수·리스트·흐름 블록 설명과 예시", 푸시, 배포 확인.

## 완료 조건
- 새 블록 23개가 양방향으로 동작하고(왕복 테스트), 리스트 카테고리가 보이며, 블록 사전에 전부 설명이 있다. 단위·e2e 통과, 배포.
