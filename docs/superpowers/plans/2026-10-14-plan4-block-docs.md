# ESP32 블록랩 — 계획 4: 블록 설명 팝업과 블록 사전

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어떤 블록이든 우클릭 → "이 블록 설명 보기" 팝업(그 블록이 만드는 코드·개념·예시)과, 모든 블록을 카테고리별로 훑어보는 `#/docs` 블록 사전을 만든다.

**Architecture:** `src/docs/`가 툴박스와 블록 정의에서 블록 카탈로그(제목·그 블록의 코드)를 헤드리스 Blockly 작업판으로 자동 생성하고, 손으로 쓴 `content/`(개념·예시 코드·팁)를 합친다. 팝업은 `Blockly.ContextMenuRegistry` 항목 → `BlocklyWorkspace.onDocRequest` → `EditorWorkbench`의 `BlockDocDialog`(shadcn Dialog). 블록 사전 화면은 같은 카탈로그를 카테고리별 Card 로 보여 주고 "편집기에서 열어 보기"로 `#/lab?example=<type>`에 예시를 싣는다.

**Tech Stack:** 기존과 같음(Blockly 13.3, React 19, shadcn/ui, lucide-react, Vitest, Playwright). shadcn `dialog`·`collapsible` 컴포넌트를 추가한다(`npx shadcn@latest add dialog collapsible`).

**Spec:** `docs/superpowers/specs/2026-10-14-block-docs-design.md`

## Global Constraints

- lucide 아이콘만, 이모지 금지, shadcn 컴포넌트만(`src/components/ui/`), 한국어 학생 문구, 영어 식별자.
- `src/docs/`는 React 비의존(순수 TS + Blockly 헤드리스). 화면은 `src/app/docs/`와 `src/components/editor/`.
- 기존 테스트 기대값 불변. 커밋마다 `npm test`·`npm run build`·`npx tsc -b --noEmit`, 마지막 Task 에서 `npm run test:e2e`.
- 예시 코드는 블록으로 되돌아가야 한다: `codeToBlocks(example.code)`의 결과에 `code_stmt`/`code_expr` 블록이 없어야 한다(테스트로 강제).
- 커밋 메시지는 한국어, 끝에 `Co-Authored-By:` 줄(작업자 모델 이름).

## 사전 확인된 사실

- 블록 등록: `registerBlocks()`(`src/blocks/index.ts`). 사용자 정의 블록 목록 `CUSTOM_BLOCK_TYPES`, 내장 블록 목록 `BUILTIN_BLOCK_TYPES`. 블록 정의는 `src/blocks/definitions/{start,flow,calc,code}.ts`(Blockly JSON, `message0`/`args0`/`tooltip`)와 장치 레지스트리(`src/devices/registry.ts` → `src/devices/toBlocks.ts`가 `DeviceSpec`의 `message`/`parts`/`tooltip`으로 Blockly JSON을 만든다).
- 툴박스: `src/blocks/toolbox.ts`의 `toolbox`(카테고리 `name`, `categorystyle`, `contents` 의 `{kind:"block", type, fields?, inputs?(shadow), extraState?}`; 변수·함수는 `custom: "VARIABLE"|"PROCEDURE"`). 하드웨어 8개 카테고리는 `deviceToolboxCategories()`.
- 카테고리 색: `src/blocks/colors.ts` `ENTRY_COLORS`(START·FLOW·JUDGE·CALC·VARIABLE·FUNC·HARDWARE·CODE), 테마 `src/blocks/theme.ts`가 `*_category` 스타일에 색을 붙인다.
- 코드 생성: `createGenerator()`·`generateCode(ws)`·`workspaceJsonToCode(json)`(`src/codegen/index.ts`). 블록 하나의 코드는 `createGenerator()` 뒤 `gen.init(ws)` → `gen.blockToCode(block)`(값 블록이면 `[code, order]` 배열)로 얻는다. 생성기는 준비 줄 끌어올리기·도우미 함수 정의를 `finish()`에서 붙이므로, 블록 하나의 코드는 `blockToCode` 결과만 쓴다(도우미 호출 표시 문자 U+E000, 줄 지도 표시 U+E001 은 `generateCode` 가 지우는 방식과 같게 지운다 — `src/codegen/index.ts` 참고).
- 파서: `codeToBlocks(code): ParseResult`(`src/parser/index.ts`), 결과 `json`(WorkspaceJson)·`unparsed`.
- 편집기: `src/components/editor/BlocklyWorkspace.tsx`(`Blockly.inject`, props `onChange/onSelect/onWarningOpen`, 핸들 `load/getJson/getCode/...`), `src/app/lab/EditorWorkbench.tsx`(자유 코딩·트랙 공용; `initialCode` 등), `src/app/lab/LabPage.tsx`(`?code=` 처리), 라우팅 `src/app/App.tsx`(`navItems`, lazy 화면).
- e2e 관례: `e2e/*.spec.ts`, `page.goto("/#/lab?device=fake")`, `getByTestId("blockly-host")`, `getByTestId("code-panel")`.
- 헤드리스 작업판 예: `src/blocks/blocks.test.ts`(`new Blockly.Workspace()` + `Blockly.serialization.blocks.append`).

## 파일 구조

```
src/docs/types.ts            BlockDoc, TitlePart, BlockContent, DocCategory
src/docs/catalog.ts          getCatalog(): DocCategory[]  (툴박스 → 블록 종류별 BlockDoc; 메모), findDoc(type), searchDocs(query)
src/docs/content/index.ts    CONTENT: Record<string, BlockContent>  (core + 장치별 파일 합침)
src/docs/content/core.ts     시작·흐름·판단·계산·변수·함수·코드 블록
src/docs/content/pin.ts … display.ts, input.ts  하드웨어 8 카테고리
src/docs/catalog.test.ts     전수 검사
src/components/editor/blockDocMenu.ts        ContextMenuRegistry 항목 등록 + 블록 코드 뽑기
src/components/editor/BlockDocDialog.tsx     팝업
src/app/docs/DocsPage.tsx                     블록 사전 화면
src/app/docs/BlockDocCard.tsx                 카드(팝업과 공유하는 본문 조각 포함)
e2e/docs.spec.ts
```

---

### Task 1: 카탈로그 + 핵심·핀·LED·버튼 내용

**Files:**
- Create: `src/docs/types.ts`, `src/docs/catalog.ts`, `src/docs/content/index.ts`, `src/docs/content/core.ts`, `src/docs/content/pin.ts`, `src/docs/content/led.ts`, `src/docs/content/switch.ts`, `src/docs/catalog.test.ts`
- Produces: `getCatalog(): DocCategory[]`, `findDoc(type: string): BlockDoc | undefined`, `searchDocs(query: string): BlockDoc[]`, `BlockContent = { concept: string; example: { title: string; code: string }; tips?: string[] }`.

**Interfaces (`src/docs/types.ts`):**
```ts
export type TitlePart = { kind: "text"; text: string } | { kind: "slot"; text: string };
export type BlockContent = { concept: string; example: { title: string; code: string }; tips?: string[] };
export type BlockDoc = {
  type: string;
  category: { id: string; name: string; colour: string };   // name: 툴박스 카테고리 이름, colour: 카테고리 primary 색
  title: TitlePart[];
  /** 툴박스 항목 그대로 만든 블록 하나의 코드 (값 블록이면 식) */
  code: string;
  /** 같은 종류가 툴박스에 여러 번 있을 때 나머지 항목의 제목 */
  variants?: TitlePart[][];
  tooltip: string;
} & BlockContent;
export type DocCategory = { id: string; name: string; colour: string; blocks: BlockDoc[] };
```

- [ ] **Step 1: 실패하는 테스트** `src/docs/catalog.test.ts`:
  - 툴박스의 모든 `kind:"block"` 항목 종류(중복 제거) + `["variables_get","variables_set","math_change","procedures_defnoreturn","procedures_defreturn","procedures_callnoreturn","procedures_callreturn","procedures_ifreturn"]` 각각에 `findDoc(type)` 이 있고 `concept.length >= 20`, `example.code.trim().length > 0`.
  - 제목 `title` 을 이어 붙인 글에 `%` 가 없다.
  - `code` 가 비지 않는다(`start_program` 과 함수 정의 블록은 빈 문자열 허용: 그 블록만으로는 코드가 없을 수 있으니 예외 목록으로 둔다).
  - 모든 예시: `codeToBlocks(example.code).json` 의 블록을 재귀로 훑어 `code_stmt`·`code_expr` 가 없다.
  - `searchDocs("깜빡")` 에 `dev_led_blink` 가 있고, `searchDocs("duty")` 에 `dev_pwm_duty10` 이 있다.
  - `getCatalog()` 카테고리 순서가 툴박스 순서(시작·흐름·판단·계산·변수·함수·핀·LED·버튼·스위치·센서·소리·모터·화면·입력장치·코드)와 같다.
- [ ] **Step 2: 실행해 실패 확인** `npx vitest run src/docs`
- [ ] **Step 3: 구현** `catalog.ts`:
  - `registerBlocks()` 를 한 번 부른 뒤(이미 등록돼 있으면 무해해야 한다; `src/blocks/index.ts` 가 어떻게 중복을 막는지 확인하고 필요하면 그 함수의 보호 로직을 쓴다) 툴박스를 돌며 카테고리마다 `contents` 의 블록 항목을 헤드리스 `new Blockly.Workspace()` 에 `Blockly.serialization.blocks.append({type, fields, inputs, extraState}, ws)` 로 만든다. 변수·함수 custom 카테고리는 고정 목록(위 8종; `variables_set` 은 `{fields:{VAR:{name:"count"}}, inputs:{VALUE:{shadow:{type:"math_number",fields:{NUM:0}}}}}` 처럼 기본값을 넣어 코드가 나오게 한다; 함수 정의는 `fields:{NAME:"my_func"}`).
  - 제목: 블록 정의의 `message0` 과 `args0` 에서 `%n` 을 → 필드면 블록의 현재 필드 글(`block.getFieldValue`/드롭다운은 보이는 라벨 `field.getText()`), 값 칸이면 그림자 블록의 글(숫자/문자) 또는 빈 슬롯 `""` 으로 바꾼다. `message1`… 이 있는 블록(controls_if 의 아니면)은 이어 붙인다. 내장 블록(`logic_compare` 등)은 Blockly 메시지(`Blockly.Msg`)가 들어간 정의를 `block.inputList` 로 훑어 같은 방식으로 만든다(정의 JSON 을 찾지 말고 `inputList` → `fieldRow` 의 `getText()` 와 값 칸을 그대로 읽는 것이 모든 블록에 통하는 한 가지 방법이다 — 이 방법만 쓴다).
  - 코드: `createGenerator()` → `gen.init(ws)` → `gen.blockToCode(block)`; 배열이면 `[0]`; 표시 문자(U+E000·U+E001 및 그 뒤 붙는 부호)를 `src/codegen/index.ts` 가 쓰는 정리 함수로 지운다(그 함수가 export 돼 있지 않으면 export 한다).
  - 카테고리 색: `theme.ts` 의 `categoryStyles[categorystyle].colour` 를 읽는다.
  - 메모: 모듈 변수에 한 번 만든 결과를 둔다. `searchDocs` 는 공백 분리 단어 모두가 제목·코드·concept·tooltip 중 어딘가에(소문자 비교) 들어가는 것.
- [ ] **Step 4: 내용 작성** `content/core.ts`(시작·흐름 8·판단 4·계산 6·변수 3·함수 5·코드 2), `content/pin.ts`, `content/led.ts`, `content/switch.ts`(해당 카테고리의 모든 장치 블록: `src/devices/specs/{pin,led,switch}.ts` 의 setup/actions/values 전부). 문체: 학생에게 말하듯 2~4문장, "이 블록은 …" 으로 시작하지 않기, 코드 식별자는 그대로. 예시는 `from machine import Pin` 같은 import 없이(생성기가 붙인다) 시작 블록 몸통에 해당하는 코드만 쓴다 — 예: 
  ```python
  led = Pin(26, Pin.OUT)
  while True:
      led.value(1)
      time.sleep(1)
      led.value(0)
      time.sleep(1)
  ```
  작성 뒤 반드시 테스트로 예시가 블록으로 돌아가는지 확인하고, 안 돌아가면 예시를 블록이 아는 꼴로 고친다(각 블록의 `pattern` 참고).
- [ ] **Step 5: 테스트 통과 확인** `npx vitest run src/docs`, `npx tsc -b --noEmit`, `npm test`.
- [ ] **Step 6: 커밋** "블록 사전 카탈로그: 툴박스에서 제목·코드 자동 생성, 핵심·핀·LED·버튼 설명"

### Task 2: 센서·소리·모터·화면·입력장치 내용

**Files:**
- Create: `src/docs/content/sensor.ts`, `sound.ts`, `motor.ts`, `display.ts`, `input.ts`; Modify: `src/docs/content/index.ts`
- 소비: Task 1 의 `BlockContent`, 테스트(`catalog.test.ts` 전수 검사가 이 Task 가 끝나야 모두 통과한다. Task 1 은 아직 없는 카테고리를 `it.todo` 가 아니라 **실패로 남기지 말고**, Task 1 커밋 시점엔 "내용이 없는 블록 종류 목록" 을 `MISSING_CONTENT` 상수로 두고 테스트가 그 목록은 건너뛴다. Task 2 는 그 상수를 비운다.)

- [ ] **Step 1:** `MISSING_CONTENT` 를 `[]` 로 비우고 테스트 실행 → 실패 확인.
- [ ] **Step 2:** 다섯 파일 작성(`src/devices/specs/{sensor,sound,motor,display,input}.ts` 의 모든 블록). 화면(OLED·LCD)·RFID·IR 처럼 라이브러리가 필요한 블록의 예시는 준비 블록 + 명령 1~2개로 짧게. 센서 값 블록 예시는 `print(...)` 나 조건문과 함께.
- [ ] **Step 3:** 테스트 전부 통과, `npm test`, `npx tsc -b --noEmit`.
- [ ] **Step 4:** 커밋 "블록 사전: 센서·소리·모터·화면·입력장치 설명과 예시"

### Task 3: 우클릭 메뉴 + 설명 팝업

**Files:**
- Create: `src/components/editor/blockDocMenu.ts`, `src/components/editor/blockDocMenu.test.ts`, `src/components/editor/BlockDocDialog.tsx`, `src/components/ui/dialog.tsx`(shadcn 추가)
- Modify: `src/components/editor/BlocklyWorkspace.tsx`(prop `onDocRequest?`), `src/app/lab/EditorWorkbench.tsx`(Dialog 상태·렌더, 자유 코딩일 때 "예시를 편집기에 열기"), `e2e/lab.spec.ts` 또는 새 `e2e/docs.spec.ts`

**Interfaces:**
```ts
// blockDocMenu.ts
export const BLOCK_DOC_MENU_ID = "block_doc";
/** 한 번만 등록. 두 번 불러도 항목은 하나. 콜백은 마지막 것으로 바뀐다 */
export function registerBlockDocMenu(onOpen: (req: { type: string; code: string; blockId: string }) => void): void;
/** 블록 하나의 코드 (우클릭한 블록의 지금 값으로). 값 블록이면 식 */
export function codeOfBlock(block: Blockly.Block): string;
```
- 메뉴 항목: `scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK`, `displayText: "이 블록 설명 보기"`, `weight: 0`, `preconditionFn: () => "enabled"`(팔레트 블록도 포함; 그림자 블록이면 부모 블록으로), `callback: (scope) => onOpen({...})`.
- `BlocklyWorkspace`: 마운트 때 `registerBlockDocMenu((req) => onDocRequestRef.current?.(req))`.
- `EditorWorkbench`: `docRequest` 상태 → `<BlockDocDialog request={docRequest} doc={findDoc(type)} onClose onOpenExample={canOpenExample ? (code) => load : undefined} />`. "예시를 편집기에 열기" 는 `hideSave`/`assemblyMode` 가 아닐 때만(자유 코딩). 열기 전 AlertDialog "지금 작업판을 예시 프로그램으로 바꿀까요?" → 확인하면 기존 `load` 경로(`initialCode` 를 싣는 것과 같은 함수)로 싣는다.
- Dialog 본문(`BlockDocDialog.tsx`): 머리: 카테고리 Badge(배경 카테고리 색) + 제목 칩(TitlePart: text 는 글, slot 은 `rounded-full bg-white/80 px-2` 칩). 섹션 "내 블록이 만드는 코드"(`<pre class="font-mono text-sm">`), "무슨 뜻인가요"(concept), "예시 프로그램"(제목 + `<pre>`), "알아 두기"(tips 목록, 있을 때만). 바닥: 버튼 "블록 사전에서 보기"(react-router `Link` to `/docs?block=<type>`), "예시를 편집기에 열기"(있을 때만), "닫기". `data-testid="block-doc-dialog"`. 문서가 없으면(알 수 없는 블록) 코드만 보여 준다.
- [ ] 단위 테스트 `blockDocMenu.test.ts`: 두 번 등록해도 `Blockly.ContextMenuRegistry.registry.getItem(BLOCK_DOC_MENU_ID)` 하나; `codeOfBlock` 이 헤드리스 작업판의 `flow_wait`(SEC 그림자 2) 블록에 `time.sleep(2)` 를, `math_number` 에 `0` 을 돌려준다; 콜백에 `{type, code}` 가 온다.
- [ ] e2e(`e2e/docs.spec.ts`): `/#/lab?device=fake` → 작업판의 "초 기다리기" 블록(`.blocklyDraggable` 중 텍스트로 찾기)을 우클릭 → 메뉴 "이 블록 설명 보기" 클릭 → `getByTestId("block-doc-dialog")` 에 `time.sleep(1)` 이 보인다 → "닫기".
- [ ] `npm test`, `npm run build`, 커밋 "블록 우클릭 → 이 블록 설명 보기 팝업"

### Task 4: 블록 사전 화면

**Files:**
- Create: `src/app/docs/DocsPage.tsx`, `src/app/docs/BlockDocCard.tsx`, `src/components/ui/collapsible.tsx`(shadcn)
- Modify: `src/app/App.tsx`(라우트 `/docs`, navItems 에 `{ to: "/docs", label: "블록 사전", icon: BookOpen }` 를 트랙 다음에), `src/app/lab/LabPage.tsx`(`?example=<type>` → `findDoc(type)?.example.code`; `?code=` 보다 먼저), `src/components/editor/BlockDocDialog.tsx`(본문 조각을 `BlockDocCard` 의 `BlockDocBody` 로 공유하도록 옮긴다), `e2e/docs.spec.ts`

- 화면: 좌측 `aside`(카테고리 목록, 색 점, 클릭하면 해당 섹션으로 스크롤; 모바일에서는 위쪽 가로 스크롤 칩 줄), 상단 검색 `Input`(placeholder "블록 이름·코드·설명 검색", 결과 수 "N개"), 본문 카테고리 섹션(`<h2 id="cat-<id>">`)과 Card 목록. Card: 제목 칩 + Badge, 코드 `<pre>`, concept, Collapsible "예시 프로그램"(펼치면 코드 + `Button` "편집기에서 열어 보기" → `Link to="/lab?example=<type>"`), tips. `data-testid="block-doc-card"` + `data-type=<type>`.
- `?block=<type>`: 마운트 뒤 그 카드로 `scrollIntoView` 하고 2초간 `ring-2` 강조.
- [ ] e2e 추가: `/#/docs` → 검색에 "깜빡" 입력 → 카드 수 ≥ 1 이고 `dev_led_blink` 카드가 보임 → "예시 프로그램" 펼침 → "편집기에서 열어 보기" → URL 에 `#/lab?example=dev_led_blink` → 코드 탭 → 코드 패널에 `range(` 가 보인다. `/#/docs?block=flow_wait` → 그 카드가 보인다(`toBeInViewport`).
- [ ] `npm test`, `npm run build`, `npm run test:e2e`, 커밋 "블록 사전 화면(#/docs): 카테고리·검색·예시 열기", 푸시, 배포 확인.

## 완료 조건
- 단위·e2e 전부 통과, 배포. 모든 툴박스 블록에 설명·예시가 있고 예시가 블록으로 돌아간다.
