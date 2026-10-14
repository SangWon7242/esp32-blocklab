# ESP32 블록랩 — 계획 5: 엔트리식 카테고리 열, 시작 블록 기본 화면, 장치별 블록 색

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 처음 열면 작업판에 "프로그램이 시작되면" 블록만 놓여 있다. (2) 왼쪽 카테고리가 엔트리처럼 아이콘+이름이 세로로 쌓인 좁은 열이고, 고른 카테고리는 그 색으로 채워진다(첨부 그림). (3) 하드웨어 8개 카테고리가 모두 같은 청록색이던 것을 카테고리마다 다른 색으로, 센서·입력장치 등 안에서는 장치마다 다른 색으로 바꿔 어떤 장치 블록인지 색만 봐도 알 수 있게 한다.

**Architecture:** 카테고리 열은 Blockly `ToolboxCategory` 를 상속한 `EntryToolboxCategory` 를 `Blockly.registry` 에 기본 카테고리로 등록해 DOM(아이콘 SVG + 이름)과 선택 상태를 바꾸고, 모양은 `src/index.css` 로 잡는다. 아이콘은 `lucide`(React 아님, 정적 SVG) 패키지의 `createElement(icon)` 으로 만들고 없는 것은 `src/blocks/icons.ts` 에 손으로 그린 SVG 문자열을 둔다. 색은 `src/blocks/colors.ts` 에 카테고리 15개 팔레트를 두고, `DeviceSpec` 에 `colour` 를 추가해 `toBlocks.ts` 가 블록 JSON 에 `colour`(Zelos 가 secondary/tertiary 를 알아서 만든다)를 넣는다. 블록 사전(`src/docs`)은 블록의 실제 색(`block.getColour()`)을 칩 색으로 쓴다.

**Tech Stack:** 기존 + `lucide`(정적 SVG, lucide-react 와 같은 아이콘 집합, ISC).

**Spec:** 이 문서(요청: 2026-10-14 12:0x 선생님 메시지와 엔트리 카테고리 그림). 기준 문서 `docs/superpowers/specs/2026-10-13-esp32-blocklab-design.md` 의 "엔트리 모양" 원칙.

## Global Constraints

- lucide 아이콘만(React 컴포넌트가 아니라 `lucide` 정적 SVG), 없으면 직접 SVG. 이모지 금지. shadcn 만. 한국어 학생 문구, 영어 식별자.
- 카테고리 이름 글자는 DOM 에 그대로 남아야 한다(e2e 가 `getByText("LED")` 같은 글로 카테고리를 누른다).
- 기존 테스트 기대값은 이 계획이 바꾸는 것(처음 화면 샘플, 하드웨어 블록 색)만 고친다. 커밋마다 `npm test`·`npx tsc -b --noEmit`·`npm run build`, 마지막에 `npm run test:e2e`.
- 커밋 메시지는 한국어, 끝에 `Co-Authored-By:` 줄(작업자 모델 이름).

## 사전 확인된 사실

- 툴박스: `src/blocks/toolbox.ts`(`toolbox` 객체, 카테고리 `name`/`categorystyle`/`contents`), 하드웨어 8개는 `src/devices/toBlocks.ts` 의 `deviceToolboxCategories()`(모두 `categorystyle: "hardware_category"`, 장치마다 `label` 행 뒤에 블록).
- 테마: `src/blocks/theme.ts`(`entryTheme`, `blockStyles` 의 `hardware_blocks`, `categoryStyles`), 색 상수 `src/blocks/colors.ts`(`ENTRY_COLORS`: START·FLOW·JUDGE·CALC·VARIABLE·FUNC·HARDWARE·CODE).
- 장치 블록 JSON: `src/devices/toBlocks.ts` 가 `style: "hardware_blocks"` 를 넣는다(명령·값·준비 블록 모두). `DeviceSpec` 은 `src/devices/types.ts`.
- 작업판 주입: `src/components/editor/BlocklyWorkspace.tsx` 의 `Blockly.inject(host, { toolbox, theme: entryTheme, renderer: "zelos", … })`. 툴박스 CSS 는 `src/index.css` 의 `.injectionDiv .blocklyToolbox { z-index: 40 }` 근처.
- 처음 화면: `src/app/lab/LabPage.tsx` 가 `initialCode={… ?? SAMPLE_CODE}`(`src/app/lab/sample.ts`, LED 1초 깜빡이기). `EditorWorkbench` 는 `initialCode` 를 `codeToBlocks` 로 블록으로 바꿔 싣는다. e2e `e2e/lab.spec.ts`·`e2e/docs.spec.ts`·`e2e/device.spec.ts` 가 샘플(`led = Pin(26`, `time.sleep(1)`)을 전제로 한 곳이 있다.
- Blockly 13.3 `ToolboxCategory`: 재정의 가능한 메서드 `createDom_`, `createRowContainer_`, `createIconDom_`, `createLabelDom_`, `addColourBorder_`, `setSelected`, `getClickTarget`. 카테고리 정의 JSON 의 추가 키는 `this.toolboxItemDef_` 로 읽는다. 등록: `Blockly.registry.register(Blockly.registry.Type.TOOLBOX_ITEM, Blockly.ToolboxCategory.registrationName, EntryToolboxCategory, true)`(마지막 `true` 가 덮어쓰기).
- 블록 사전 카탈로그 `src/docs/catalog.ts` 는 카테고리 색을 `theme.ts` 의 `categoryStyles` 에서 읽고, `BlockDoc.category.colour` 로 칩·배지를 칠한다(`src/app/docs/BlockDocCard.tsx`, `src/lib/contrast.ts` 가 글자색을 고른다).

## 파일 구조

```
src/blocks/colors.ts           CATEGORY_COLORS(15개) + DEVICE 색 도우미(deviceColour)
src/blocks/icons.ts            CATEGORY_ICONS: 카테고리 이름 → SVG 문자열 (lucide createElement 또는 손 SVG)
src/blocks/entryToolbox.ts     EntryToolboxCategory + registerEntryToolbox()
src/blocks/toolbox.ts          카테고리마다 icon 키, categorystyle 을 카테고리별 스타일로
src/blocks/theme.ts            categoryStyles 15개, hardware_blocks 는 남기되 장치 블록은 colour 를 쓴다
src/devices/types.ts           DeviceSpec.colour
src/devices/specs/*.ts         장치마다 colour
src/devices/toBlocks.ts        블록 JSON 에 colour, 카테고리마다 categorystyle·icon
src/app/lab/sample.ts          START_ONLY_CODE(빈 프로그램) + SAMPLE_CODE(LED, 블록 사전 예시용으로 남김)
src/index.css                  카테고리 열 모양
src/docs/catalog.ts            BlockDoc.colour(블록 실제 색)
e2e/toolbox.spec.ts            카테고리 열 e2e
```

---

### Task 1: 시작 블록만 있는 첫 화면 + 엔트리식 카테고리 열

**Files:** Create `src/blocks/icons.ts`, `src/blocks/entryToolbox.ts`, `e2e/toolbox.spec.ts`; Modify `src/blocks/toolbox.ts`, `src/devices/toBlocks.ts`(카테고리 `icon` 키만), `src/blocks/colors.ts`, `src/blocks/theme.ts`(categoryStyles 15개), `src/components/editor/BlocklyWorkspace.tsx`(등록 호출), `src/index.css`, `src/app/lab/sample.ts`, `src/app/lab/LabPage.tsx`, 관련 e2e.

- [ ] **시작 화면:** `sample.ts` 에 `START_ONLY_CODE = ""` 를 두고 `LabPage` 의 기본 `initialCode` 를 그것으로. 빈 코드가 `codeToBlocks` 로 시작 블록 하나(몸통 없음)가 되는지 확인하고, 아니면 `EditorWorkbench` 의 처음 싣기에서 블록이 하나도 없으면 `start_program` 을 (40, 40) 에 하나 만든다. 트랙 단계(`?code=`)와 `?example=` 은 그대로. 샘플이 필요한 e2e 는 `?example=dev_led_blink` 나 코드 모드 입력으로 바꾼다(`SAMPLE_CODE` 상수는 남겨 둔다).
- [ ] **팔레트(15개):** `colors.ts` 에 `CATEGORY_COLORS: Record<CategoryId, { primary; secondary; tertiary }>` — 시작 `#00b400`, 흐름 `#19baea`, 판단 `#4562f5`, 계산 `#f4af18`, 변수 `#dd47d8`, 함수 `#de5c04`, 코드 `#8aa3b2`(기존), 하드웨어: 핀 `#00b6b1`, LED `#f2c21c`→계산과 겹치므로 LED 는 `#e0a800` 대신 **`#ffb000`**, 버튼·스위치 `#8a5cf6`, 센서 `#5b9a1a`, 소리 `#e4518c`, 모터 `#d9480f`, 화면 `#2d6cdf`, 입력장치 `#8b6b3e`. 색은 서로 구분돼야 한다(같은 계열이 둘 이상이면 명도 차를 둔다). secondary/tertiary 는 primary 에서 밝게/어둡게(`src/lib/contrast.ts` 의 도우미를 쓰거나 새 도우미).
- [ ] **아이콘:** `npm i lucide`. `icons.ts` 에 카테고리 → SVG 문자열: 시작 `Flag`, 흐름 `Repeat`, 판단 `Check`, 계산 `Calculator`, 변수 `Box`, 함수 `SquareFunction`, 핀 `Pin`, LED `Lightbulb`, 버튼·스위치 `ToggleLeft`, 센서 `Radar`, 소리 `Volume2`, 모터 `Fan`, 화면 `Monitor`, 입력장치 `Keyboard`, 코드 `Code`. `createElement(icon)` → `outerHTML`. 없는 이름이 있으면 손 SVG(24×24, stroke 2, currentColor).
- [ ] **EntryToolboxCategory:** `createRowContainer_` 로 세로 레이아웃(아이콘 위, 이름 아래), `createIconDom_` 이 `icons.ts` 의 SVG 를 넣고 `color` 를 카테고리 색으로, `setSelected(true)` 면 행 배경을 카테고리 색으로 채우고 아이콘·글자는 흰색, 아니면 배경 흰색·글자 진회색. 카테고리 정의에 `icon` 키 없으면 아이콘 없이 이름만. `registerEntryToolbox()` 는 한 번만 등록(모듈 변수 가드). `BlocklyWorkspace` 가 `registerBlocks()` 뒤, `inject` 앞에 부른다. 스크롤: 카테고리가 세로로 다 안 보이면 열 안에서 스크롤(`overflow-y: auto`).
- [ ] **CSS(`index.css`):** 열 폭 84px, 행 높이 ~64px, 아이콘 26px, 이름 12px/600, 행 사이 1px 선, 모서리 둥글게 없음(그림처럼 꽉 찬 타일), 호버는 연한 회색. 플라이아웃은 그대로 오른쪽.
- [ ] **e2e `e2e/toolbox.spec.ts`:** `/#/lab` 을 열면 작업판에 "프로그램이 시작되면" 블록이 있고 코드 패널은 비어 있다(또는 import 없음); 카테고리 열에 15개 행이 있고 각 행에 `svg` 아이콘이 있다; "LED" 를 누르면 그 행의 배경색이 LED 색이고 플라이아웃이 열린다; 다른 카테고리를 누르면 이전 행은 흰 배경으로 돌아온다.
- [ ] `npm test`·tsc·build·`npm run test:e2e` → 커밋 "엔트리식 카테고리 열(아이콘·색), 처음 화면은 시작 블록만".

### Task 2: 장치별 블록 색

**Files:** Modify `src/devices/types.ts`, `src/devices/specs/*.ts`, `src/devices/toBlocks.ts`, `src/blocks/colors.ts`(도우미), `src/blocks/theme.ts`, `src/docs/catalog.ts`·`src/docs/types.ts`·`src/app/docs/BlockDocCard.tsx`(칩 색), 테스트.

- [ ] `DeviceSpec.colour: string`(필수, hex). 같은 카테고리 안 장치들은 카테고리 색을 중심으로 **색상(hue)을 고르게 벌린다**(예: 센서 11개는 카테고리 색 hue ±40° 안에서 고르게, 명도는 비슷하게). `colors.ts` 에 `spreadHues(base: string, n: number): string[]` 도우미를 두고 각 spec 파일이 그 결과를 장치 순서대로 쓰거나, 장치마다 손으로 적는다(손으로 적을 때는 같은 카테고리 안에서 서로 다르고 카테고리 색과 같은 계열이어야 한다는 테스트를 둔다).
- [ ] `toBlocks.ts`: 장치 블록 JSON 에 `style` 대신 `colour: d.colour`(준비·명령·값 모두). `alsoIn`/`extraToolbox` 로 다른 카테고리에 나오는 블록은 원래 장치 색을 유지한다(블록 색은 블록 종류에 붙는다).
- [ ] 블록 사전: `BlockDoc.colour` 를 블록의 `getColour()` 로 채우고 카드·팝업의 제목 칩은 `doc.colour`, 카테고리 배지·점은 `category.colour`. 대비 도우미는 그대로.
- [ ] 테스트: `src/devices/devices.test.ts`(또는 새 파일)에 "모든 장치에 colour 가 있고 hex 꼴이며, 같은 카테고리 안에서 서로 다르다", `src/blocks/blocks.test.ts` 에 "장치 블록의 colour 가 spec.colour 와 같다", `src/docs/catalog.test.ts` 에 "BlockDoc.colour 가 hex".
- [ ] `npm test`·tsc·build·`npm run test:e2e` → 커밋 "장치마다 다른 블록 색(센서·입력장치 등 장치별 구분)". 푸시, 배포 확인.

## 완료 조건
- 첫 화면에 시작 블록만, 카테고리 열이 그림처럼 아이콘+이름 세로 타일, 15개 카테고리 색이 모두 다르고, 같은 카테고리 안 장치 블록도 서로 다른 색. 단위·e2e 통과, 배포.
