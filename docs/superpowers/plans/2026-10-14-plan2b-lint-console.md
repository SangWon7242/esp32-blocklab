# ESP32 블록랩 — 계획 2B: 검사 엔진, 코드 지도, 문제·콘솔 패널 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 블록을 놓는 즉시 오류·주의를 블록 위에 한글로, 코드 모드의 콘솔에 영어로 보여 주고, 블록·문제 항목·콘솔 항목을 누르면 그 코드 줄(과 블록)이 함께 강조되게 한다.

**Architecture:** (1) 생성기가 블록 id 표식(STATEMENT_PREFIX)을 넣어 코드를 만든 뒤 표식을 걷어 내며 **코드 지도**(블록 id ↔ 줄 번호)를 만든다. 준비 블록·도우미 함수·함수 정의는 생성기의 끌어올리기 장부로 지도에 넣는다. (2) `src/lint/`의 순수 함수 검사 엔진이 작업판 JSON + 레지스트리 메타데이터(`requiredKinds`, 핀 `dir`, `provides`, `range`) + 코드 지도로 문제 목록(한글·영어·줄 번호)을 낸다. (3) 화면은 문제를 블록 경고 아이콘(오류는 빨간 테두리)과 하단 "문제"(한글)·"콘솔"(영어) 탭에 보여 주고, 블록 선택·항목 클릭을 코드 줄 강조로 잇는다. 코드 모드에서는 재생성 코드 줄을 학생이 친 원문 줄에 맞추는 정렬 함수로 줄 번호를 옮긴다.

**Tech Stack:** 계획 2A와 같음. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-13-plan2-sensors-lint-device-design.md` 3장 (+ 선생님 추가 요구: 오류·주의 표시를 누르면 어떤 코드에서 생겼는지 확인).

## Global Constraints

- lucide 아이콘만, 이모지 금지, shadcn 컴포넌트만, 한국어 학생 문구, 영어 식별자.
- `src/lint`는 React·Blockly 비의존(순수 함수; `@/devices/*`, `@/parser` 타입만). `src/codegen`은 Blockly 의존 허용.
- 기존 테스트 기대값 불변(계획 2A 테스트 426개 + e2e 9개). `generateCode(ws)` 출력은 바뀌지 않는다(표식은 `generateCodeWithMap`에서만).
- 커밋: `npm test`·`npm run build` 통과, 한국어 제목 + 작업 모델의 `Co-Authored-By` 트레일러. 마지막 Task 뒤 `npm run test:e2e` 통과 후 푸시, Pages 배포 확인.
- 작업 폴더 `/Users/lucas/works/python_projects/esp32-blocklab`, 브랜치 `main`.

## 사전 확인된 사실 (현재 코드, 그대로 믿어도 됨)

- `src/codegen/generator.ts` `MicroPythonGenerator`: `setupLines`(준비 줄, `addSetup`이 첫 줄 번호를 `lastSetupLine`에 둠), `provideHelper(name, lines)`(Blockly `provideFunction_`; 이름이 바뀔 수 있어 `helperCall(name)`이 `name` 표식을 내고 `finish`가 `functionNames_`로 바꿈), `setDefinition("%name", code)`(사용자 함수), `finish(code)`가 import·준비 줄·도우미/함수·본문을 조립하고 `hoistImports`로 import 를 맨 위로 올린다, `scrub_`가 블록 코멘트를 윗줄/줄 끝 주석으로 붙이고 `next` 블록 코드를 잇는다. Blockly `blockToCode`는 명령 블록 코드 앞에 `STATEMENT_PREFIX`(`injectId`로 `%1`→블록 id)를 **`scrub_` 호출 전에** 붙인다. 값 블록(배열 반환)에는 붙이지 않는다. 준비 블록 생성기는 `""`를 돌려주므로 표식만 남는다. 함수 정의 블록은 `null`을 돌려주고 코드를 `definitions_`에 넣으므로 표식이 붙지 않는다.
- `src/codegen/index.ts`: `createGenerator()`, `generateCode(ws)`(공유 생성기), `workspaceJsonToCode(json)`(헤드리스), `type WorkspaceJson`.
- `src/devices/registry.ts`: `DEVICES`, `findSetupByBlock/findActionByBlock/findValueByBlock`, `setupSpecs()`, `requiredKinds(spec)`, `defaultValues(parts)`, `setupVars`, `fixedSetupNames()`, `libFilesFor`. `src/devices/types.ts`: `Part`(`pin` 부분에 `dir: "out"|"in"|"adc"|"bus"|"mode"`+`modeField`), `SetupSpec.provides(values)`, `ActionSpec.range: Record<input, {min,max,label:{ko,en}}>`, `ActionSpec.varKinds`. `src/devices/specs/common.ts`: `ADC_PINS`.
- 작업판 JSON(`Blockly.serialization.workspaces.save`)에는 블록 `id`가 있다. 파서의 `codeToBlocks` JSON에는 id가 없고 작업판에 올릴 때 Blockly가 붙인다. **따라서 코드 지도는 실제(살아 있는) 작업판에서 만들어야 id가 맞는다.**
- `src/components/editor/BlocklyWorkspace.tsx`: `BlocklyHandle { load(json, {keepScroll}), getJson(), getCode() }`, `onChange(json, code)`를 변경 이벤트(UI 이벤트·드래그 중 제외)마다 부른다. `src/app/lab/LabPage.tsx`: `editorReducer` 상태 `{source, code, blocks, unparsed, parseError}`, `BottomPanel`(탭 `problems|console`, `children`로 `TabsContent` 두 개를 넣을 수 있음), `CodePanel` props `{value, readOnly, onChange, errorLine}`(1-based 한 줄 강조). e2e 9개(`e2e/lab.spec.ts`).
- Blockly 13: `block.setWarningText(text, id?)`로 경고 아이콘·말풍선, `block.getSvgRoot()`에 클래스 추가 가능, 이벤트 `Blockly.Events.SELECTED`(`newElementId`), `Blockly.Events.BUBBLE_OPEN`(`bubbleType: "warning"`, `blockId`, `isOpen`), `ws.getBlockById(id)`, `ws.centerOnBlock(id)`, `block.select()`.

## 파일 구조

```
src/codegen/linemap.ts          LineMap 타입, 표식 걷기·지도 만들기 (순수 함수)
src/codegen/generator.ts        표식 모드(withMap), 준비·도우미·함수 정의 장부, scrub_ 표식 인식
src/codegen/index.ts            generateCodeWithMap(ws), workspaceJsonToCodeWithMap(json)
src/lint/types.ts               Issue, Level, LintContext
src/lint/walk.ts                작업판 JSON 평탄화 (블록·부모·입력 이름·필드)
src/lint/labels.ts              블록 type → 한글 이름 (레지스트리 메시지 + 흐름·계산 표)
src/lint/rules/*.ts             규칙 하나씩: noStart, emptyInput, deviceBeforeSetup, pinRule, valueRange, pinConflict, loopWithoutSleep, orphan, undefinedVariable, rawCode
src/lint/index.ts               lint(json, map, opts) → Issue[]
src/lint/format.ts              콘솔 영어 문구·Traceback 꼴, 문제 패널 한글 문구
src/lint/align.ts               재생성 코드 줄 → 원문 줄 정렬 (코드 모드)
src/app/lab/ProblemsPanel.tsx   문제 탭 내용
src/app/lab/ConsolePanel.tsx    콘솔 탭 내용 (계획 2C가 보드 출력도 여기에 붙인다)
src/app/lab/useLint.ts          디바운스 검사 + 정렬 + 선택/강조 상태
src/components/editor/BlocklyWorkspace.tsx  setIssues, selectBlock, onSelect, onWarningOpen, getCodeWithMap
src/components/editor/CodePanel.tsx         highlightLines(여러 줄, 종류별 색), onLineClick
e2e/lab.spec.ts                 검사·양방향 이동 e2e
```

---

### Task 1: 코드 지도 (블록 id ↔ 줄 번호)

**Files:**
- Create: `src/codegen/linemap.ts`, `src/codegen/linemap.test.ts`
- Modify: `src/codegen/generator.ts`, `src/codegen/index.ts`, `src/devices/toCodegen.ts`(준비 블록 장부), `src/codegen/forBlock.ts`(함수 정의 표식), `src/components/editor/BlocklyWorkspace.tsx`, `src/app/lab/LabPage.tsx`·`editorSync.ts`(map 보관)

**Interfaces:**
- `type LineMap = { blockToLines: Record<string, number[]>; lineToBlock: Record<number, string> }` (1-based 줄 번호, 표식 없는 최종 코드 기준)
- `generateCodeWithMap(ws: Blockly.Workspace): { code: string; map: LineMap }` — `code`는 `generateCode(ws)`와 **같은 문자열**(테스트로 보장)
- `workspaceJsonToCodeWithMap(json)` (헤드리스; id는 JSON의 id)
- `BlocklyHandle.getCodeWithMap()`, `onChange(json, code, map)`
- `EditorState.map: LineMap | null`

- [ ] **Step 1: 테스트** (`linemap.test.ts`) — 작업판 JSON에 id를 직접 넣어 헤드리스로:
  - 챕터 1 `step4_blink_loop` 꼴(준비 1 + 계속 반복 + 켜기/기다리기/끄기/기다리기): `blockToLines["setup_led"] == [4]`(`led = Pin(26, Pin.OUT)` 줄), `["loop"] == [6]`, `["on"] == [7]`, `["w1"] == [8]`…, `lineToBlock[7] == "on"`, import 줄은 어느 블록에도 없음.
  - `controls_if` + else: `if` 줄과 `else:` 줄이 모두 if 블록 id로.
  - 여러 줄 명령(`dev_led_blink`): 5줄 모두 blink 블록 id.
  - 준비 블록 + 도우미(초음파): `trig/echo` 준비 2줄과 `def get_distance():` 본문 전부가 준비 블록 id.
  - 사용자 함수 `procedures_defnoreturn`: `def blink(t):` 줄은 def 블록 id, 몸통 줄은 각 블록 id.
  - 코멘트가 있는 블록: 윗줄 주석은 지도에 없고(또는 같은 블록 — 둘 중 하나로 정하고 테스트에 명시: **같은 블록으로**), 줄 끝 주석이 붙은 줄은 그 블록.
  - `generateCodeWithMap(ws).code === generateCode(ws)` (표식이 남지 않는다) — 14개 수업 파일 JSON으로도 확인(`roundtrip` 보조 테스트).
- [ ] **Step 2: 구현**
  - `generator.ts`: `withMap` 플래그. `init`에서 `withMap`이면 `this.STATEMENT_PREFIX = MARK + "%1" + MARK + "\n"`(`MARK = ""`), 아니면 `""`. `scrub_`: 코드가 표식 줄로 시작하면 줄 끝 주석을 **둘째 줄**에 붙이고, 윗줄 주석은 표식 줄 **뒤**(즉 표식 → 주석 줄들 → 문장)에 넣어 주석 줄도 그 블록에 속하게 한다. 준비 블록: `addSetup`이 넣은(또는 이미 있던) 줄 번호들을 돌려주고 `toCodegen.ts`가 `gen.noteSetupBlock(block.id, indices)`로 장부에 적는다; `provideHelper`가 호출된 준비 블록 id도 `noteHelperOwner(name, block.id)`. 함수 정의: `forBlock.ts defGenerator`가 `withMap`이면 def 코드 맨 앞에 표식 줄을 넣는다(`gen.markFor(block)`).
  - `finish`: 조립이 끝난 뒤 `buildLineMap(textWithMarks, extra)`(`linemap.ts`)로 표식을 걷어 내며 지도를 만든다. 규칙: 표식 줄 다음 줄부터 **다음 표식 줄 전까지, 들여쓰기가 그 블록의 첫 줄 들여쓰기보다 깊거나 같은 줄**은 그 블록(스택: 표식 줄에서 (들여쓰기, id)를 푸시, 더 얕은 줄을 만나면 팝). 그래서 `while` 줄은 while 블록, 몸통은 각자 표식, `else:`는 if 블록, 여러 줄 명령은 모두 그 블록. 준비 줄·도우미 def 줄은 장부로(최종 줄 번호는 조립 뒤 setup 구역·helpers 구역의 시작 줄로 계산). import·머리말 줄은 어느 블록에도 없음.
  - `index.ts`: `generateCodeWithMap(ws)`는 공유 생성기의 `withMap=true`로 한 번 돌리고 끝나면 `false`로 되돌린다(`try/finally`).
  - `BlocklyWorkspace.tsx`: 변경 리스너가 `generateCodeWithMap(ws)`를 써서 `onChange(json, code, map)`; `getCodeWithMap()`. `editorSync.ts`: `blocksChanged` 액션에 `map`, 상태 `map`; `switchSource("blocks")`·코드 모드 재로드 뒤 `LabPage`가 `blocklyRef.current.getCodeWithMap().map`을 상태에 넣는다(`{ type: "mapUpdated", map }` 액션).
- [ ] **Step 3**: `npm test`(기존 + 새) · `npm run build` · 커밋 "코드 지도: 블록 id ↔ 코드 줄".

---

### Task 2: 검사 엔진 (순수 함수)

**Files:**
- Create: `src/lint/types.ts`, `walk.ts`, `labels.ts`, `rules/*.ts`(10개), `index.ts`, `format.ts`, `align.ts`, 테스트 `src/lint/rules.test.ts`, `src/lint/align.test.ts`, `src/lint/format.test.ts`

**Interfaces:**
- `type Level = "error" | "warning" | "info"`
- `type Issue = { id: string /* 규칙 id */; level: Level; blockId?: string; line?: number; ko: string; en: string }`
- `lint(json: WorkspaceJson, map: LineMap | null): Issue[]` — 오류 → 주의 → 정보, 같은 수준은 줄 번호 순
- `formatConsole(issues: Issue[], parseError: {line, message} | null): ConsoleEntry[]` where `ConsoleEntry = { level, text: string /* 영어, 여러 줄 가능 */, line?: number, blockId?: string }`; 문법 오류는 `Traceback (most recent call last):\n  File "main.py", line N\nSyntaxError: invalid syntax`
- `alignLines(generated: string, source: string): Map<number, number>` — 재생성 코드 줄 → 원문 줄 (주석·공백을 뗀 텍스트가 같은 줄을 앞에서부터 짝짓기; 못 찾으면 없음)
- `blockLabel(type: string): string` — 한글 블록 이름 (레지스트리 메시지에서 `%n`을 `…`로 바꾼 것; 흐름·계산·판단·변수·함수 블록은 `labels.ts` 표)

- [ ] **Step 1: 규칙별 테스트** (`rules.test.ts`; 작업판 JSON은 계획 1 `codegen.test.ts`의 `program()`/`chain()` 도우미를 `src/lint/testkit.ts`로 복사해 id를 붙여 쓴다)
  | 규칙 id | 오류 사례 → 기대 | 정상 사례 |
  |---|---|---|
  | `no-start` | 시작 블록 없음 → error, ko "프로그램이 시작되면 블록이 없어요", en `Error: no "프로그램이 시작되면" block`, line 1 | 있음 → 없음 |
  | `empty-input` | `flow_wait`의 SEC 비어 있음 → error on that block, ko "이 칸에 값을 넣어 주세요", en `SyntaxError: missing value for "… 초 기다리기"` | shadow 있음 → 없음 |
  | `device-before-setup` | `esp_pin_write` VAR=led, 준비 블록 없음 → error "led 를 먼저 준비해 주세요 (핀 블록)", `NameError: name 'led' is not defined`; `dev_oled_clear`(고정 이름) 준비 없음 → "OLED 화면을 먼저 준비해 주세요"; `dev_led_blink` VAR=led 준비 없음 → error; 다른 kind 준비(`esp_servo_setup` VAR=led)만 있을 때 `esp_pin_write led` → error "led 는 서보 모터예요. 핀 블록으로 준비해 주세요" | 준비 있음 → 없음; print 블록 → 없음 |
  | `pin-rule` | `esp_pin_setup` PIN 34 MODE OUT → error "34번 핀은 입력만 할 수 있어요", `ValueError: pin 34 is input-only`; `dev_adc_setup` PIN 5 → error "5번 핀은 아날로그 입력을 할 수 없어요 (32~39, 25~27 등)", `ValueError: pin 5 has no ADC`; `esp_oled_setup` SCL 36 → error | PIN 26 OUT, ADC 36 → 없음 |
  | `value-range` | `dev_servo_angle` ANGLE math_number 200 → error "각도는 0~180 사이여야 해요", `ValueError: angle must be 0..180`; shadow 값도 검사 | 90 → 없음; 변수 → 없음 |
  | `pin-conflict` | `esp_pin_setup` 13 led + `esp_ultrasonic_setup` TRIG 13 → warning on 둘째 블록 "13번 핀을 trig 와 led 가 같이 쓰고 있어요", `Warning: pin 13 used by trig and led` | 다른 핀 → 없음 |
  | `loop-without-sleep` | `flow_repeat_forever` 몸통에 `esp_pin_write`만 → warning "반복 안에 기다리기가 없으면 보드가 바빠져요", `Warning: loop without sleep` | `flow_wait`/`dev_led_blink`/`dev_beeper_tone` 포함 → 없음; `controls_whileUntil`도 같은 규칙 |
  | `orphan` | 시작 블록 밖 최상위 `esp_pin_write` → warning "시작 블록에 붙이지 않은 블록은 실행되지 않아요", `Warning: orphan block ignored` | 함수 정의 최상위 → 없음 |
  | `undefined-variable` | `variables_get d`, `variables_set` 없음 → warning "d 는 아직 값을 정하지 않았어요", `NameError: name 'd' may be undefined` | set 있음 / 함수 매개변수 / 준비 블록 VAR / `flow_repeat_n` 안의 `i` → 없음 |
  | `raw-code` | `code_stmt` → info "이 코드는 블록으로 바꾸지 못했어요. 그대로 실행됩니다", `Note: raw code kept as-is` | — |
  정렬: 오류 먼저, 그다음 주의, 정보; 같은 수준은 line 오름차순. 각 Issue의 `line`은 `map.blockToLines[blockId][0]`(없으면 undefined).
- [ ] **Step 2: 구현** — `walk.ts`가 JSON을 `{ id, type, fields, inputs(이름→자식 id/shadow), parentId, inputName, topLevel }[]`로 편다. `deviceBeforeSetup`은 작업판의 준비 블록들에서 `provides(values)`·`setup.kind`로 `name → kind` 표를 만들고, 명령/값 블록은 `requiredKinds(spec)`과 VAR 필드 이름(또는 `objName`/고정 이름 장치의 setup 존재)을 대조한다. 한글 장치 이름은 `DeviceSpec.label`.
- [ ] **Step 3: `format.ts`·`align.ts` 테스트와 구현** — `alignLines`: 수업 파일 `step3_auto_door.py`를 파싱 → 헤드리스 재생성 → 정렬했을 때 `while True:`·`if d < 15:`·`servo.duty_u16(8100)` 줄이 원문의 맞는 줄로 간다; 원문에만 있는 주석 줄은 건너뛴다.
- [ ] **Step 4**: `npm test` · `npm run build` · 커밋 "검사 엔진: 규칙 10개, 콘솔 문구, 줄 정렬".

---

### Task 3: 화면 — 블록 경고, 문제·콘솔 패널, 양방향 이동

**Files:**
- Modify: `src/components/editor/BlocklyWorkspace.tsx`, `src/components/editor/CodePanel.tsx`, `src/app/lab/LabPage.tsx`, `src/app/lab/BottomPanel.tsx`, `src/index.css`
- Create: `src/app/lab/useLint.ts`, `src/app/lab/ProblemsPanel.tsx`, `src/app/lab/ConsolePanel.tsx`
- Test: `e2e/lab.spec.ts`(+4), `src/app/lab/useLint.test.ts`(순수 부분)

**Interfaces:**
- `BlocklyHandle` 추가: `setIssues(issues: Issue[])`(블록마다 `setWarningText(ko 문구 + " — 코드 N줄", "lint")`, 오류는 SVG 루트에 `lint-error` 클래스, 주의는 `lint-warning`; 사라진 문제는 지운다), `selectBlock(id)`(select + centerOnBlock), props `onSelect?(blockId | null)`, `onWarningOpen?(blockId)`.
- `CodePanel` props 추가: `highlightLines?: { line: number; kind: "error" | "warning" | "info" | "focus" }[]`(여러 줄 장식; `errorLine`은 유지), `onLineClick?(line)`.
- `useLint(state, map, source)` → `{ issues, console: ConsoleEntry[], focus: { blockId?, lines: number[] }, setFocus }`: 블록/코드가 바뀌면 100ms 디바운스로 `lint()`; 코드 모드면 `alignLines(regenerated, state.code)`로 `line`을 원문 줄로 옮기고 `parseError`를 콘솔 맨 위 Traceback으로.

- [ ] **Step 1: e2e 테스트**
  - "값 칸을 비우면 블록에 경고가 뜨고 문제 패널에 한글로 나온다": `#/lab`에서 흐름 → `초 기다리기` 블록을 작업판에 드래그(기존 드래그 테스트 재사용) → 그 블록의 shadow 숫자를 지운다(드래그한 블록의 숫자 shadow는 비울 수 없으니 대신 `flow_repeat_n`의 `TIMES`에 끼운 값 블록을 삭제하는 방식 또는 **코드 모드에서 `time.sleep()`을 쳐서 블록으로 만든 뒤**(인자 없는 호출은 code_stmt가 되므로 부적합) → 가장 단순한 방법: 코드 모드에서 `led = Pin(26, Pin.OUT)\nled.value(1)\n`을 치고 다시 `led = …` 줄을 지워 `led.value(1)`만 남긴다 → 블록 모드로 → `esp_pin_write` 블록에 경고 아이콘(`.blocklyWarningIcon`?) 또는 `lint-error` 클래스, 문제 패널에 "led 를 먼저 준비해 주세요") — 이 시나리오로 확정.
  - "문제 항목을 누르면 코드 줄이 강조된다": 위 상태에서 문제 항목 클릭 → 코드 패널에 `.cm-lint-focus` 줄이 있고 그 줄 텍스트가 `led.value(1)`.
  - "블록을 선택하면 그 코드 줄이 강조된다": 샘플 프로그램에서 `켜기` 블록 클릭 → 코드 패널 7번째 줄 강조.
  - "코드 모드의 콘솔은 영어로 문법 오류를 보여 준다": 코드 모드에서 `if x` 입력 → 콘솔 탭에 `SyntaxError: invalid syntax`와 `line N`; 항목 클릭 → 그 줄 강조.
- [ ] **Step 2: 구현**
  - `BlocklyWorkspace.tsx`: `setIssues`는 이전 문제 블록 집합과 비교해 바뀐 것만 갱신(`setWarningText(null, "lint")`로 지움). 선택 이벤트(`Blockly.Events.SELECTED`)와 말풍선 열림(`BUBBLE_OPEN`, `bubbleType === "warning"`)을 콜백으로. CSS(`src/index.css`): `.lint-error > .blocklyPath { stroke: #ef4444; stroke-width: 3px }`, `.lint-warning > .blocklyPath { stroke: #f59e0b; stroke-width: 3px }`.
  - `CodePanel.tsx`: `highlightLines` 장식(`StateField`), 종류별 배경(`cm-lint-error` 빨강 12%, `cm-lint-warning` 노랑 12%, `cm-lint-focus` 파랑 15% + 왼쪽 테두리), 줄 번호 거터 클릭 → `onLineClick(line)`.
  - `ProblemsPanel.tsx`: shadcn 스타일 목록(아이콘 `CircleAlert` 빨강/`TriangleAlert` 노랑/`Info` 회색, 한글 문구, "N줄" 배지), 클릭 → `setFocus({ blockId, lines })` → `selectBlock` + 코드 강조. 비어 있으면 "문제가 없어요".
  - `ConsolePanel.tsx`: 고정폭 글꼴, 항목(영어 `text`, 여러 줄은 그대로), 클릭 → 줄 강조 + (`map.lineToBlock`이 있으면) 블록 선택. 계획 2C가 보드 출력 행을 같은 목록에 붙일 수 있게 `entries: ConsoleEntry[]` props로.
  - `LabPage.tsx`: `useLint` 연결, `BottomPanel`에 두 `TabsContent`를 children으로, 문제 수 배지를 탭 라벨에(`문제 2`), 오류가 하나라도 있으면 하단 패널을 자동으로 펼친다(한 번만).
  - 한글 말풍선 문구: `"<ko> — 코드 N줄"`(줄을 모르면 ko만).
- [ ] **Step 3**: `npm test` · `npm run build` · `npm run test:e2e`(9 + 4) · 커밋 "블록 경고·문제/콘솔 패널·블록-코드 양방향 강조" · `git push` · Pages 배포 확인.

## 계획 2B 완료 조건

- 배포 페이지에서: 준비 없이 `led 켜기`를 놓으면 즉시 빨간 테두리 + 한글 말풍선, 하단 문제 탭에 항목; 항목·블록을 누르면 코드 줄 강조; 코드 모드에서 문법 오류가 콘솔에 영어 Traceback으로 보이고 누르면 줄 강조.
- `npm test`·`npm run test:e2e` 통과. 다음: 계획 2C(보드 연결, 콘솔에 보드 출력).
