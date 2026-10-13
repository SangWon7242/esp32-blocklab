# ESP32 블록랩 — 계획 2A: 편집기 정리와 장치 레지스트리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스크롤바 버그와 계획 1에서 미룬 문제를 모두 고치고, 센서·장치 블록을 "장치 하나 = 선언 하나"인 레지스트리로 옮겨 KS5020 키트 전체(핀·LED·버튼·센서·소리·모터·화면·입력장치)를 블록으로 다룰 수 있게 한다.

**Architecture:** `src/devices/`에 장치 선언(`DeviceSpec`)과 산출기를 둔다. 블록 JSON·툴박스 카테고리·생성기(`forBlock`)·import 표·파서 접기 규칙·라이브러리 목록은 모두 선언에서 만들어진다. 기존 ESP32 블록 14개는 블록 이름과 필드 이름을 그대로 유지한 채 레지스트리로 옮긴다. 파서는 하드코딩된 핀/PWM/초음파/OLED 규칙 대신 레지스트리의 패턴(연속 줄 묶음, 메서드 호출, 도우미 호출, 식 정규식)을 일반 규칙으로 적용한다.

**Tech Stack:** 계획 1과 같음 + `@blockly/field-colour`(RGB 색 고르기).

**Spec:** `docs/superpowers/specs/2026-10-13-plan2-sensors-lint-device-design.md` (1장·2장), 기준 `docs/superpowers/specs/2026-10-13-esp32-blocklab-design.md`

## Global Constraints

- 아이콘은 `lucide-react`만, 이모지 금지, UI 컴포넌트는 `src/components/ui/`(shadcn)만. 문구는 한국어(학생 언어), 식별자는 영어.
- `src/blocks`·`src/codegen`·`src/parser`·`src/devices`는 React 비의존. `src/parser`와 `src/devices`는 **런타임에 Blockly를 import하지 않는다**(`import type`만). `src/blocks`가 레지스트리를 읽어 Blockly 블록을 정의한다.
- 기존 블록 type·필드 이름은 바꾸지 않는다: `esp_pin_setup`(PIN, MODE, VAR), `esp_pin_write`(VAR, VALUE), `esp_pin_read`(VAR), `esp_pwm_setup`(VAR, PIN, FREQ), `esp_servo_setup`(VAR, PIN), `esp_pwm_duty`(VAR, DUTY), `esp_servo_door`(VAR, ACTION), `esp_ultrasonic_setup`(TRIG, ECHO), `esp_distance`, `esp_oled_setup`(SCL, SDA), `esp_oled_show`(A, B), `esp_print`(VALUE), `esp_print2`(A, B).
- 기존 테스트의 기대 문자열은 바꾸지 않는다(특히 `src/codegen/codegen.test.ts`, `src/parser/roundtrip.test.ts`의 14개 파일 왕복, `src/parser/parser.test.ts`). 테스트가 참조하는 **모듈 경로**만 바뀔 수 있다(예: `GET_DISTANCE_BODY`가 레지스트리로 옮겨 가는 경우 import 경로 수정은 허용).
- 생성 코드 모양: 들여쓰기 4칸, 큰따옴표, 준비 줄은 import 아래에 모임, 도우미 함수 → 사용자 함수 → 본문. 새 장치의 코드는 이 문서 Task 5~7 표의 문자열을 **그대로** 쓴다.
- 각 Task는 `npm test`·`npm run build` 통과 상태로 커밋(한국어 제목 + 작업한 모델을 밝히는 `Co-Authored-By` 트레일러), 마지막 Task 뒤 `npm run test:e2e` 통과 후 푸시, Pages 배포 확인.
- 작업 폴더: `/Users/lucas/works/python_projects/esp32-blocklab`, 브랜치 `main`.

## 사전 확인된 사실

- 스크롤바 버그 원인: Blockly는 팔레트를 닫을 때 `.blocklyFlyoutScrollbar` SVG에 `display="none"` **속성**을 둔다. Tailwind preflight의 `svg { display: block }` CSS가 속성보다 우선해 스크롤바가 남는다(배포 DOM에서 확인: 팔레트 `display:none`, 스크롤바 `display:block`, 인라인 style 없음).
- 현재 코드 구조(계획 1 결과, 읽고 그대로 믿어도 됨):
  - `src/blocks/definitions/esp32.ts`: ESP32 블록 14개 JSON. `src/blocks/index.ts`의 `registerBlocks()`가 `definitions` 배열을 `defineBlocksWithJsonArray`로 등록하고 `CUSTOM_BLOCK_TYPES`를 낸다. `src/blocks/toolbox.ts`에 카테고리 8개(시작·흐름·판단·계산·변수·함수·ESP32·코드).
  - `src/codegen/generator.ts`의 `MicroPythonGenerator`: `addSetup(...lines)`(준비 줄 끌어올리기, 중복 제거, 첫 줄 번호를 `lastSetupLine`에 기록해 코멘트를 붙임), `provideHelper(name, lines)`(도우미 함수, 본문은 **2칸 단위** 들여쓰기로 넘긴다 — `provideFunction_`이 2칸을 INDENT로 바꾼다), `setDefinition`, `scrubBlock`, `finish()`가 `collectImports`·`hoistImports`로 import를 계산한다. `src/codegen/forBlock.ts`에 블록별 생성기(esp_* 포함). `src/codegen/imports.ts`의 `collectImports(text)`는 machine 이름 [Pin, PWM, SoftI2C]과 ssd1306·time만 안다.
  - `src/parser/index.ts`의 `survey()`가 최상위 문장 텍스트로 핀·PWM·서보·I2C/OLED·초음파 접기 여부를 정하고(`ctx.pins/pwms/servos/ultrasonicFolded/oledFolded/echoPin`), `src/parser/statements.ts`의 `convertStatement`가 `RE_*` 정규식과 `following` 문장 미리보기로 준비 블록을 접고, 메서드 호출을 `esp_pin_write`/`esp_servo_door`/`esp_pwm_duty`/`flow_wait*`로, 함수 호출을 `esp_print*`/`esp_oled_show`/`procedures_call*`로 바꾼다. `src/parser/expressions.ts`의 `convertAny`가 `get_distance()`→`esp_distance`, `obj.value()`→`esp_pin_read`를 만들고 `OUTPUT_TYPES` 표로 형식 검사 폴백을 한다. `src/parser/patterns.ts`에 `RE_PIN_SETUP` 등 정규식, `STANDARD_GET_DISTANCE`/`STANDARD_SHOW`, `isKnownImport`, `isValidPin`, `isStandardBody`, `functionParts`, `returnsValue`.
  - `src/parser/context.ts`의 `ParseContext`: `variables`, `pins`, `pwms`, `servos`, `functions`, `unparsed`, `duplicateDefs`, `header`, 주석 줄 큐(`takeLeading/skipComments`), `markUnparsed`.
  - 블록 코멘트 규약: 코멘트 텍스트에서 `|`로 시작하는 줄이 줄 끝 주석, 나머지가 윗줄 주석(`generator.ts` `splitComment`).
  - `src/app/lab/LabPage.tsx`: 상단 탭(블록/코드)·비활성 보드 버튼, `ResizablePanelGroup orientation="horizontal"`(react-resizable-panels v4: `defaultSize="62"` 퍼센트 문자열), 오른쪽 코드 패널 헤더에 "변환 못 한 줄" 배지(`state.unparsed.length`)와 문법 오류 배지. `editorSync.ts` 리듀서(`blocksChanged`/`codeChanged`/`switchSource`/`loadCode`), `BlocklyWorkspace.tsx`(`load()`가 `revealProgram`으로 스크롤, `disableOrphans`, `maxInstances`), `CodePanel.tsx`(CodeMirror, `echoGuard`), `namePrompt.ts`(변수 이름 검사 `isValidPythonName`).
  - `src/app/App.tsx`: HashRouter, 헤더(로고 + 메뉴 3개), `LabPage`를 직접 import.
  - e2e: `e2e/lab.spec.ts` 5개(블록→코드, 코드→블록, 빠른 탭 전환 flush, 문법 오류 시 탭 유지, 팔레트 드래그).
- Keyestudio KS5020 MicroPython 튜토리얼의 API(확인함): `ADC(Pin(36))`, `adc.atten(ADC.ATTN_11DB)`, `adc.width(ADC.WIDTH_12BIT)`, `adc.read()`; `button = Pin(14, Pin.IN, Pin.PULL_UP)`; `dht.DHT11(Pin(13))`, `.measure()`, `.temperature()`, `.humidity()`; `from irrecvdata import irGetCMD`, `irGetCMD(5).ir_read()`; `from keypad import KeyPad`, `KeyPad(26, 25, 17, 16, 27, 14, 12, 13).scan()`; `from lcd128_32 import lcd128_32`, `import lcd128_32_fonts`, `lcd128_32(sda, scl, bus, addr)`, `.Init()`, `.Clear()`, `.Cursor(y, x)`, `.Display(str)`; `from mfrc522_i2c import mfrc522`, `mfrc522(22, 21, 0x28)`, `.PCD_Init()`, `.PICC_IsNewCardPresent()`, `.PICC_ReadCardSerial()`, `.uid.uidByte[0:rc522.uid.size]`; 수동 부저는 PWM `freq`/`duty`; 7세그먼트는 74HC595 `hc595_shift` 도우미(수업 저장소 챕터 6). 라이브러리 파일: `ssd1306.py gfx.py mfrc522_i2c.py mfrc522_config.py soft_iic.py irrecvdata.py keypad.py lcd128_32.py lcd128_32_fonts.py` (`https://docs.keyestudio.com/projects/KS5020/en/latest/_downloads/aa55cec3f54bf29d6d697256c354e3bd/Library.zip` → `Library/MicroPython_Library/`).
- `@blockly/field-colour`: `import { registerFieldColour } from "@blockly/field-colour"`, JSON `{ type: "field_colour", name: "COLOUR", colour: "#ff69b4" }`, 값은 `#rrggbb` 소문자.

## 파일 구조 (이 계획에서 만들거나 바꾸는 것)

```
src/devices/
  types.ts            DeviceSpec·SetupSpec·ActionSpec·ValueSpec·FieldSpec·ArgSpec·Pattern 타입
  registry.ts         DEVICES 배열(모든 장치 선언) + 조회 함수 (findSetup/findAction/findValue, devicesByCategory)
  specs/pin.ts        핀 장치(출력·입력·PWM·아날로그) — 기존 esp_pin_*/esp_pwm_* 포함
  specs/led.ts        LED·밝기 LED·RGB·흐르는 LED
  specs/switch.ts     버튼·틸트·PIR·조이스틱
  specs/sensor.ts     조도·가변저항·소리·불꽃·서미스터·LM35·초음파(기존)·DHT11
  specs/sound.ts      능동 부저·수동 부저
  specs/motor.ts      서보(기존 + 각도)·DC 모터·릴레이
  specs/display.ts    OLED(기존 + 글자·지우기·내보내기·선·사각형)·LCD128×32·7세그먼트
  specs/input.ts      RFID·키패드·IR 리모컨
  toBlocks.ts         DeviceSpec → Blockly 블록 JSON 배열 + 툴박스 카테고리
  toCodegen.ts        DeviceSpec → forBlock 생성기 등록 (addSetup/provideHelper/코드 템플릿)
  imports.ts          레지스트리 import 표 → collectImports/isKnownImport 가 쓰는 규칙 목록
  subexpr.ts          정규식으로 잡은 조각 텍스트를 식 블록으로 (파서 재사용)
  devices.test.ts     레지스트리 모양 검사(블록 type 유일, 필드 이름, 메시지 %n 개수)
public/lib/*.py       Keyestudio MicroPython 라이브러리 9개 + README.md
src/blocks/definitions/esp32.ts   삭제 (레지스트리 산출물로 대체)
src/blocks/index.ts               레지스트리 블록 등록, field_colour 등록
src/blocks/toolbox.ts             하드웨어 카테고리 8개를 레지스트리에서 생성
src/codegen/forBlock.ts           esp_* 항목 제거, toCodegen 등록 호출
src/codegen/imports.ts            레지스트리 import 규칙 사용 (machine 이름 확장: ADC)
src/parser/patterns.ts            하드코딩 RE_*·STANDARD_* 제거, 레지스트리 패턴 매칭 도우미
src/parser/context.ts             pins/pwms/servos → devices: Map<varName, {deviceId, kind}> , folded: Set<deviceId>
src/parser/index.ts               survey 가 레지스트리로 접기 여부 결정
src/parser/statements.ts          준비 줄·메서드·도우미 호출 접기를 레지스트리로
src/parser/expressions.ts         값 블록(메서드/도우미/식 정규식) 접기를 레지스트리로, OUTPUT_TYPES 에 장치 값 블록 추가
src/index.css                     svg[display="none"] 규칙
src/app/App.tsx                   LabPage lazy, 좁은 화면 헤더
src/app/lab/LabPage.tsx           좁은 화면 탭 레이아웃, 패널 접기, 하단 패널 틀, 배지 계산
src/components/editor/BlocklyWorkspace.tsx  load 시 스크롤 유지·undo 비우기, 함수 블록 배치
src/components/editor/namePrompt.ts        함수 이름에도 적용
e2e/lab.spec.ts                   스크롤바·좁은 화면·접기 테스트 추가
```

---

### Task 1: 스크롤바 버그와 편집기 정리

**Files:**
- Modify: `src/index.css`, `src/app/App.tsx`, `src/app/lab/LabPage.tsx`, `src/app/lab/editorSync.ts`, `src/components/editor/BlocklyWorkspace.tsx`, `src/components/editor/namePrompt.ts`, `src/parser/index.ts`(함수 블록 배치·for 변수), `src/parser/statements.ts`(for 변수 등록), `src/codegen/generator.ts`·`src/parser/builders.ts`(`|` 이스케이프)
- Test: `e2e/lab.spec.ts`(스크롤바), `src/parser/parser.test.ts`(for 변수, `|` 주석), `src/app/lab/editorSync.test.ts`(배지 계산), `src/components/editor/namePrompt.test.ts`(함수 이름)

**Interfaces:**
- Produces: `countCodeBlocks(json: WorkspaceJson): number` (editorSync.ts, 블록 모드 배지용), `BlocklyHandle.load(json, { keepScroll?: boolean })`.

- [ ] **Step 1: 스크롤바 e2e 테스트(실패 확인용)**

`e2e/lab.spec.ts`에 추가:
```ts
test("팔레트를 닫으면 팔레트 스크롤바도 사라진다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByText("흐름", { exact: true }).click();
  const flyoutBar = page.locator(".blocklyFlyoutScrollbar").first();
  await expect(flyoutBar).toBeVisible();
  await page.locator(".blocklyMainBackground").click({ position: { x: 600, y: 500 } });
  await expect(page.locator(".blocklyFlyout").first()).toBeHidden();
  await expect(flyoutBar).toBeHidden();
});
```
Run: `npm run test:e2e -- -g "스크롤바"` → Expected: FAIL (`flyoutBar` still visible).

- [ ] **Step 2: CSS 수정**

`src/index.css`의 `@layer base` 안에 추가:
```css
  /* Blockly 는 숨길 요소에 display="none" 속성을 두는데 preflight 의 svg { display: block } 이 이긴다 */
  svg[display="none"], g[display="none"] {
    display: none !important;
  }
```
Run: `npm run test:e2e -- -g "스크롤바"` → PASS.

- [ ] **Step 3: 블록 모드 배지는 코드 블록 개수로**

`src/app/lab/editorSync.ts`에 추가하고 테스트:
```ts
/** 작업판에 남은 코드 블록(code_stmt·code_expr) 수. 블록 모드의 "변환 못 한" 배지가 쓴다 */
export function countCodeBlocks(json: WorkspaceJson | null): number {
  if (!json) return 0;
  let n = 0;
  const visit = (b: { type: string; inputs?: Record<string, { block?: unknown; shadow?: unknown }>; next?: { block: unknown } } | undefined) => {
    if (!b) return;
    if (b.type === "code_stmt" || b.type === "code_expr") n++;
    for (const i of Object.values(b.inputs ?? {})) { visit(i.block as never); visit(i.shadow as never); }
    visit(b.next?.block as never);
  };
  for (const top of (json.blocks?.blocks ?? []) as never[]) visit(top);
  return n;
}
```
테스트(`editorSync.test.ts`): `countCodeBlocks(codeToBlocks("x = time.ticks_us()\noled.fill(0)\n").json) === 2`, 샘플 코드는 0. `LabPage.tsx`: 블록 모드에서는 `countCodeBlocks(state.blocks)`를, 코드 모드에서는 `state.unparsed.length`를 배지에 쓴다(툴팁의 줄 목록은 코드 모드에서만).

- [ ] **Step 4: 전환 때 스크롤 유지와 실행취소 비우기, 함수 블록 배치**

`BlocklyWorkspace.tsx` `load(json, opts?: { keepScroll?: boolean })`: `keepScroll`이면 `ws.scrollX/scrollY`를 기억했다가 load 뒤 `ws.scroll(x, y)`로 되돌리고 `revealProgram`을 건너뛴다. load 뒤 항상 `ws.clearUndo()`. `LabPage.tsx`의 코드→블록 전환(`switchSource("blocks")`)과 코드 모드 재파싱 로드는 `keepScroll: true`, 첫 로드는 기본값.
`src/parser/index.ts`: 함수 블록 위치를 `t.x = 40 + 520 * (i + 1); t.y = 40`(시작 블록 오른쪽)로.

- [ ] **Step 5: `for i` 변수 등록과 `|` 주석 이스케이프**

`src/parser/statements.ts` ForStatement: `flow_repeat_n`으로 바꿀 때 `ctx.varId("i")`를 등록해 몸통의 `i`가 `variables_get`이 되게 한다(테스트: `for i in range(3):\n    print(i)\n` → 몸통 `esp_print`의 VALUE가 `variables_get`, `unparsed` 0). 단 변수 목록에는 `i`가 남아도 된다.
`|` 이스케이프: 파서 `commentText`(builders.ts)에서 원문 줄이 `|`로 시작하면 `\|`로 적고, 생성기 `splitComment`는 `\|`로 시작하는 줄을 윗줄 주석으로 돌리며 `\|`→`|`로 되돌린다. 테스트: 원문 `# | a | b |\nprint(1)\n`이 왕복에서 같은 주석 줄을 낸다(주석 줄 비교).

- [ ] **Step 6: 함수 이름 검사, LabPage 지연 로딩**

`namePrompt.ts`의 프롬프트는 Blockly가 변수·함수 이름 둘 다에 쓴다. `createNamePrompt`가 메시지에 "함수"가 들어 있으면 힌트 문구를 "함수 이름은 영어 글자, 숫자, _ 만 쓸 수 있어요 (예: blink)"로 바꾸고 같은 검사(`isValidPythonName`)를 적용한다. Blockly의 함수 이름 필드(`procedures_defnoreturn`의 NAME 텍스트 필드)는 프롬프트가 아니라 직접 편집이므로, `registerBlocks()`에서 `Blockly.Procedures`의 이름 검증 대신 `Blockly.Blocks.procedures_defnoreturn.init` 패치로 NAME 필드에 `setValidator(name => isValidPythonName(name) ? name : null)`을 단다(`controls_if` 패치와 같은 방식, `procedures_defreturn`도). 테스트(`blocks.test.ts`): 헤드리스 `procedures_defnoreturn` 블록의 NAME 필드에 `"함수"`를 넣으면 값이 바뀌지 않고, `"blink2"`는 받아들인다.
`App.tsx`: `const LabPage = lazy(() => import("./lab/LabPage").then((m) => ({ default: m.LabPage })))`, `<Suspense fallback={<div className="p-8 text-muted-foreground">편집기를 불러오는 중…</div>}>`. `npm run build` 결과에서 홈 청크가 Blockly를 포함하지 않는지(`dist/assets` 파일 목록에 LabPage 청크가 따로 있는지) 확인해 보고서에 적는다.

- [ ] **Step 7: 전체 테스트, 커밋**

Run: `npm test && npm run build && npm run test:e2e`
```bash
git add -A && git commit -m "편집기 정리: 팔레트 스크롤바 숨김, 배지·스크롤·배치·반복 변수·주석 이스케이프, 함수 이름 검사, 지연 로딩

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 2: 좁은 화면 레이아웃, 패널 접기, 하단 패널 틀

**Files:**
- Modify: `src/app/App.tsx`(헤더), `src/app/lab/LabPage.tsx`
- Create: `src/app/lab/useViewport.ts`(`useIsNarrow(): boolean`, `matchMedia("(max-width: 1023px)")`), `src/app/lab/BottomPanel.tsx`(접을 수 있는 하단 패널 틀: 탭 `문제 | 콘솔`은 계획 2B가 채우므로 지금은 "아직 메시지가 없어요" 안내만)
- Test: `e2e/lab.spec.ts`(좁은 화면 탭, 접기)

**Interfaces:**
- Produces: `BottomPanel` props `{ open: boolean; onToggle(): void; children?: ReactNode }`; `LabPage` 상태 `panels: { blocks: boolean; code: boolean; bottom: boolean }`.

- [ ] **Step 1: e2e 테스트 작성**

```ts
test("좁은 화면에서는 블록과 코드가 탭으로 바뀐다", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto("/#/lab");
  await expect(page.getByTestId("code-panel")).toBeHidden();
  await page.getByRole("tab", { name: "코드" }).click();
  await expect(page.getByTestId("code-panel")).toBeVisible();
  await expect(page.getByTestId("blockly-host")).toBeHidden();
  // 헤더가 가로 스크롤을 만들지 않는다
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("코드 패널을 접었다 펼 수 있다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("button", { name: "코드 패널 접기" }).click();
  await expect(page.getByTestId("code-panel")).toBeHidden();
  await page.getByRole("button", { name: "코드 패널 펼치기" }).click();
  await expect(page.getByTestId("code-panel")).toBeVisible();
});
```
Run: `npm run test:e2e -- -g "좁은 화면|접었다"` → FAIL.

- [ ] **Step 2: 좁은 화면 레이아웃**

`useViewport.ts`:
```ts
import { useEffect, useState } from "react";
const QUERY = "(max-width: 1023px)";
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}
```
`LabPage.tsx`: `narrow`이면 `ResizablePanelGroup` 대신 현재 `state.source`에 따라 한 패널만 보여 준다(블록 모드 → 작업판, 코드 모드 → 코드 패널). 숨긴 쪽은 `hidden` 클래스가 아니라 **마운트는 유지하고 `display:none`**(Blockly 작업판을 언마운트하면 상태를 잃는다). 넓은 화면에서는 패널 헤더 끝에 접기 버튼(`PanelRightClose`/`PanelRightOpen` 아이콘, `aria-label="코드 패널 접기"`/`"코드 패널 펼치기"`, shadcn `Button variant="ghost" size="icon"`)을 두고 접히면 코드 패널 `ResizablePanel`을 `collapsible` + `collapsedSize="0"`로 접는다(react-resizable-panels v4의 `usePanelRef`/`panel.collapse()`·`expand()` 사용; 안 되면 조건부 렌더링으로 패널을 빼고 작업판만 남긴다). 작업판 쪽에도 같은 접기 버튼(`aria-label="블록 패널 접기"`).
`App.tsx` 헤더: `nav` 항목 글자는 `hidden md:inline`, 아이콘은 항상, `header`에 `overflow-hidden whitespace-nowrap`, 로고 글자 `hidden sm:inline`.

- [ ] **Step 3: 하단 패널 틀**

`BottomPanel.tsx`: 높이 `h-40`(열림)/`h-8`(접힘) 전환, 헤더 줄에 탭 자리(`Tabs`에 `문제`·`콘솔` 트리거, 지금은 둘 다 "아직 메시지가 없어요")와 접기 버튼(`ChevronDown`/`ChevronUp`, `aria-label="하단 패널 접기/펼치기"`). `LabPage`의 세로 배치: 상단 바 → (가로 패널 그룹) → `BottomPanel`. 기본은 접힘.

- [ ] **Step 4: 테스트, 커밋**

Run: `npm test && npm run build && npm run test:e2e` → 모두 PASS.
```bash
git add -A && git commit -m "좁은 화면 탭 레이아웃, 패널 접기, 하단 패널 틀

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 3: 장치 레지스트리 핵심과 기존 14개 블록 이전 (블록·생성기·import)

**Files:**
- Create: `src/devices/types.ts`, `src/devices/registry.ts`, `src/devices/specs/pin.ts`, `src/devices/specs/sensor.ts`(초음파만), `src/devices/specs/motor.ts`(서보만), `src/devices/specs/display.ts`(OLED만), `src/devices/specs/misc.ts`(print 두 개), `src/devices/toBlocks.ts`, `src/devices/toCodegen.ts`, `src/devices/imports.ts`, `src/devices/devices.test.ts`
- Modify: `src/blocks/index.ts`, `src/blocks/toolbox.ts`, `src/codegen/forBlock.ts`, `src/codegen/imports.ts`, `src/codegen/index.ts`
- Delete: `src/blocks/definitions/esp32.ts`
- Test: 기존 `src/blocks/blocks.test.ts`, `src/blocks/toolbox-roundtrip.test.ts`, `src/codegen/*.test.ts`, `src/parser/*.test.ts` 전부 그대로 통과(파서는 아직 하드코딩 규칙을 쓴다 — Task 4에서 바꾼다).

**Interfaces:**
- Produces (Task 4·5·6·7과 계획 2B가 쓴다):
  - `DEVICES: DeviceSpec[]`, `DEVICE_CATEGORIES: { id: DeviceCategory; label: string }[]` (순서: pin 핀, led LED, switch 버튼·스위치, sensor 센서, sound 소리, motor 모터, display 화면, input 입력장치)
  - `findSetupByBlock(type)`, `findActionByBlock(type)`, `findValueByBlock(type)`, `setupSpecs(): SetupSpec[]`
  - `deviceBlockDefinitions(): Record<string, unknown>[]`, `deviceToolboxCategories(): ToolboxCategory[]`
  - `registerDeviceGenerators(gen: MicroPythonGenerator): void`
  - `IMPORT_RULES: ImportRule[]`, `collectImports(text)`(확장), `isGeneratedImport(line)`(파서의 `isKnownImport`가 쓴다)
  - 블록 메시지 규약: `message`의 `%1…%n`은 `parts` 배열 순서(필드·값 입력 섞어서)와 일치.

- [ ] **Step 1: 타입**

`src/devices/types.ts`:
```ts
export type DeviceCategory = "pin" | "led" | "switch" | "sensor" | "sound" | "motor" | "display" | "input";

/** 블록 한 칸. 필드(고정 값)와 값 입력(다른 블록이 끼워짐)을 메시지의 %n 순서대로 나열한다 */
export type Part =
  | { kind: "pin"; name: string; default: number; inputOnly?: boolean } // field_number 0..39
  | { kind: "var"; name: string; default: string }                      // field_variable (보통 "VAR")
  | { kind: "number"; name: string; default: number; min?: number; max?: number; precision?: number }
  | { kind: "dropdown"; name: string; options: [label: string, value: string][] }
  | { kind: "text"; name: string; default: string }                     // field_input
  | { kind: "colour"; name: string; default: string }                   // field_colour "#rrggbb"
  | { kind: "value"; name: string; check?: "Number" | "String" | "Boolean"; shadow?: number | string }; // input_value

/** 코드 템플릿이 받는 값: 필드는 문자열(변수 필드는 생성기가 이름으로 바꿔 준다), 값 입력은 생성된 코드 조각 */
export type Values = Record<string, string>;

/**
 * 파서가 알아보는 꼴.
 * - lines: 최상위 연속 문장들의 정규식. 모두 맞으면 준비 블록 하나로 접는다. 그룹은 fields 로 넘어간다.
 * - method: 등록된 장치 변수의 메서드 호출 `obj.name(args)`. args 는 인자별 허용 리터럴(드롭다운 값) 또는 null(아무 식).
 * - call:   접힌 도우미 함수 호출 `name(args)`.
 * - expr:   식 전체 텍스트의 정규식(값 블록 전용, 예: `button.value() == 0`). 그룹 1은 장치 변수 이름.
 */
export type SetupPattern = {
  lines: RegExp[];
  /** 정규식 매치 배열 → 필드 값. 핀 범위 밖이면 null 을 돌려 접지 않는다 */
  fields: (m: RegExpExecArray[]) => Values | null;
  /** 접힌 뒤 ctx 에 등록할 장치 변수 이름들 (m 에서 뽑거나 고정 이름) */
  vars: (m: RegExpExecArray[]) => string[];
};
export type ActionPattern =
  | { kind: "none" }                                   // 파서가 되돌리지 않는 명령(다른 블록들로 돌아온다)
  | { kind: "method"; name: string; args: (string[] | null)[]; objPart?: string /* VAR 필드 이름 */; objName?: string /* 고정 이름 */; objKinds?: string[] /* 기본: 자기 장치 kind */ }
  | { kind: "call"; name: string; args: (string[] | null)[] }
  | { kind: "lines"; lines: RegExp[]; values: (m: RegExpExecArray[]) => Values | null; objPart?: string }
  | { kind: "expr"; regex: RegExp; objPart?: string; values?: (m: RegExpExecArray) => Values };

export type HelperSpec = { name: string; params: string; body: string[] /* 2칸 단위 들여쓰기 */ };

export type SetupSpec = {
  blockType: string;
  message: string;
  parts: Part[];
  tooltip: string;
  /** 준비 줄. 변수 필드 값은 이미 파이썬 이름으로 바뀌어 온다 */
  lines: (v: Values) => string[];
  helpers?: HelperSpec[];
  /** 이 장치 변수들의 종류. 메서드 패턴이 objKind 로 맞춘다 */
  kind: string;
  pattern: SetupPattern;
  libFiles?: string[];
};

export type ActionSpec = {
  blockType: string;
  message: string;
  parts: Part[];
  tooltip: string;
  /** 명령 코드(줄바꿈 없이; 여러 줄이면 \n 으로 잇는다). 생성기가 끝에 \n 을 붙인다 */
  code: (v: Values) => string;
  pattern: ActionPattern;
  /** 검사용 값 범위 (계획 2B) */
  range?: Record<string, [number, number]>;
};

export type ValueSpec = Omit<ActionSpec, "code"> & {
  code: (v: Values) => string;
  output: string | string[] | null;
  /** blockly/python Order 값. 기본 FUNCTION_CALL */
  order?: number;
};

export type DeviceSpec = {
  id: string;
  category: DeviceCategory;
  label: string;
  /** print 처럼 준비가 필요 없는 묶음은 생략 */
  setup?: SetupSpec;
  actions: ActionSpec[];
  values: ValueSpec[];
  /** 이 카테고리들에도 같은 항목을 보여 준다 (예: 핀 출력 블록을 LED 카테고리에도) */
  alsoIn?: DeviceCategory[];
  /** 라벨 아래에 다른 장치의 블록을 필드 기본값만 바꿔 넣는다 (예: 조도 센서 밑에 dev_adc_read VAR=light) */
  extraToolbox?: { blockType: string; fields: Record<string, string> }[];
};

export type ImportRule = { when: RegExp; line: string; rank: number };
```

- [ ] **Step 2: 레지스트리 모양 테스트**

`src/devices/devices.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DEVICES, DEVICE_CATEGORIES, findActionByBlock, findSetupByBlock, findValueByBlock } from "./registry";
import { deviceBlockDefinitions, deviceToolboxCategories } from "./toBlocks";

const allBlocks = () => DEVICES.flatMap((d) => [d.setup.blockType, ...d.actions.map((a) => a.blockType), ...d.values.map((v) => v.blockType)]);

describe("장치 레지스트리", () => {
  it("블록 type 이 겹치지 않는다", () => {
    const types = allBlocks();
    expect(new Set(types).size).toBe(types.length);
  });
  it("메시지의 %n 개수가 parts 개수와 같다", () => {
    for (const d of DEVICES) for (const s of [d.setup, ...d.actions, ...d.values]) {
      const n = (s.message.match(/%\d+/g) ?? []).length;
      expect(n, s.blockType).toBe(s.parts.length);
    }
  });
  it("기존 14개 블록이 그대로 있다", () => {
    for (const t of ["esp_pin_setup", "esp_pin_write", "esp_pin_read", "esp_pwm_setup", "esp_servo_setup", "esp_pwm_duty", "esp_servo_door", "esp_ultrasonic_setup", "esp_distance", "esp_oled_setup", "esp_oled_show", "esp_print", "esp_print2"]) {
      expect(findSetupByBlock(t) ?? findActionByBlock(t) ?? findValueByBlock(t), t).toBeTruthy();
    }
    expect(findSetupByBlock("esp_pin_setup")!.parts.map((p) => p.name)).toEqual(["PIN", "MODE", "VAR"]);
  });
  it("블록 JSON 과 툴박스를 만든다", () => {
    const defs = deviceBlockDefinitions();
    expect(defs.map((d) => d.type)).toEqual(expect.arrayContaining(allBlocks()));
    const cats = deviceToolboxCategories();
    expect(cats.map((c) => c.name)).toEqual(DEVICE_CATEGORIES.map((c) => c.label));
  });
});
```
Run → FAIL(모듈 없음).

- [ ] **Step 3: 기존 블록을 선언으로 옮기기**

`src/devices/specs/pin.ts` (기존 핀·PWM·서보·print 블록; print 는 `misc.ts`로):
```ts
import type { DeviceSpec } from "../types";

const pinNo = (name: string, d: number) => ({ kind: "pin" as const, name, default: d });
const RE_NAME = String.raw`(\w+)`;
const RE_PIN = String.raw`(\d+)`;
const validPins = (...ns: string[]) => ns.every((n) => Number(n) >= 0 && Number(n) <= 39);

export const pinOut: DeviceSpec = {
  id: "pin_out", category: "pin", label: "핀",
  setup: {
    blockType: "esp_pin_setup",
    message: "핀 %1 을(를) %2 으로 준비하고 %3 이름 붙이기",
    parts: [pinNo("PIN", 26), { kind: "dropdown", name: "MODE", options: [["출력", "OUT"], ["입력", "IN"]] }, { kind: "var", name: "VAR", default: "led" }],
    tooltip: "led = Pin(26, Pin.OUT) 처럼 핀에 이름을 붙입니다. 코드 맨 위에 모입니다.",
    lines: (v) => [`${v.VAR} = Pin(${v.PIN}, Pin.${v.MODE})`],
    kind: "pin",
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*Pin\(\s*${RE_PIN}\s*,\s*Pin\.(OUT|IN)\s*\)$`)],
      fields: ([m]) => (validPins(m[2]) ? { VAR: m[1], PIN: m[2], MODE: m[3] } : null),
      vars: ([m]) => [m[1]],
    },
  },
  actions: [
    {
      blockType: "esp_pin_write", message: "%1 %2",
      parts: [{ kind: "var", name: "VAR", default: "led" }, { kind: "dropdown", name: "VALUE", options: [["켜기", "1"], ["끄기", "0"]] }],
      tooltip: "led.value(1) 은 켜기, led.value(0) 은 끄기",
      code: (v) => `${v.VAR}.value(${v.VALUE})`,
      pattern: { kind: "method", name: "value", args: [["0", "1"]], objPart: "VAR" },
    },
  ],
  values: [
    {
      blockType: "esp_pin_read", message: "%1 값",
      parts: [{ kind: "var", name: "VAR", default: "echo" }],
      tooltip: "echo.value() — 입력 핀의 값(0 또는 1)",
      code: (v) => `${v.VAR}.value()`,
      output: ["Number", "Boolean"],
      pattern: { kind: "method", name: "value", args: [], objPart: "VAR" },
    },
  ],
};

export const pwm: DeviceSpec = {
  id: "pwm", category: "pin", label: "PWM 핀",
  setup: {
    blockType: "esp_pwm_setup", message: "PWM %1 을(를) 핀 %2 에 준비하기 (주파수 %3 Hz)",
    parts: [{ kind: "var", name: "VAR", default: "pwm" }, pinNo("PIN", 2), { kind: "number", name: "FREQ", default: 1000, min: 1 }],
    tooltip: "pwm = PWM(Pin(2)); pwm.freq(1000)",
    lines: (v) => [`${v.VAR} = PWM(Pin(${v.PIN}))`, `${v.VAR}.freq(${v.FREQ})`],
    kind: "pwm",
    pattern: {
      lines: [new RegExp(String.raw`^${RE_NAME}\s*=\s*PWM\(\s*Pin\(\s*${RE_PIN}\s*\)\s*\)$`), new RegExp(String.raw`^${RE_NAME}\.freq\(\s*(\d+)\s*\)$`)],
      fields: ([a, b]) => (a[1] === b[1] && validPins(a[2]) ? { VAR: a[1], PIN: a[2], FREQ: b[2] } : null),
      vars: ([a]) => [a[1]],
    },
  },
  actions: [
    {
      blockType: "esp_pwm_duty", message: "%1 세기를 %2 로 정하기",
      parts: [{ kind: "var", name: "VAR", default: "pwm" }, { kind: "value", name: "DUTY", check: "Number", shadow: 32768 }],
      tooltip: "pwm.duty_u16(0~65535)",
      code: (v) => `${v.VAR}.duty_u16(${v.DUTY})`,
      pattern: { kind: "method", name: "duty_u16", args: [null], objPart: "VAR" },
      range: { DUTY: [0, 65535] },
    },
  ],
  values: [],
};
```
`src/devices/specs/motor.ts`의 서보(기존):
```ts
export const servo: DeviceSpec = {
  id: "servo", category: "motor", label: "서보 모터",
  setup: {
    blockType: "esp_servo_setup", message: "서보 %1 을(를) 핀 %2 에 준비하기 (처음엔 닫기)",
    parts: [{ kind: "var", name: "VAR", default: "servo" }, pinNo("PIN", 4)],
    tooltip: "servo = PWM(Pin(4)); servo.freq(50); servo.duty_u16(1638)",
    lines: (v) => [`${v.VAR} = PWM(Pin(${v.PIN}))`, `${v.VAR}.freq(50)`, `${v.VAR}.duty_u16(1638)`],
    kind: "servo",
    pattern: {
      lines: [/^(\w+)\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/, /^(\w+)\.freq\(\s*50\s*\)$/, /^(\w+)\.duty_u16\(\s*1638\s*\)$/],
      fields: ([a, b, c]) => (a[1] === b[1] && a[1] === c[1] && validPins(a[2]) ? { VAR: a[1], PIN: a[2] } : null),
      vars: ([a]) => [a[1]],
    },
  },
  actions: [
    {
      blockType: "esp_servo_door", message: "%1 문 %2",
      parts: [{ kind: "var", name: "VAR", default: "servo" }, { kind: "dropdown", name: "ACTION", options: [["열기", "8100"], ["닫기", "1638"]] }],
      tooltip: "열기 = duty_u16(8100), 닫기 = duty_u16(1638)",
      code: (v) => `${v.VAR}.duty_u16(${v.ACTION})`,
      pattern: { kind: "method", name: "duty_u16", args: [["8100", "1638"]], objPart: "VAR" },
    },
  ],
  values: [],
};
```
**레지스트리 순서 규칙**: `DEVICES` 배열에서 같은 줄에 맞는 선언이 여럿이면 **먼저 나온 것**이 이긴다. 서보(3줄)가 PWM(2줄)보다 앞에 와야 `freq(50)+duty_u16(1638)`이 서보로 접힌다. 또 메서드 패턴은 `objKind`가 같은 장치 변수에만 맞으므로, `duty_u16` 리터럴 8100/1638은 servo 변수에서만 `esp_servo_door`가 되고 pwm 변수에서는 `esp_pwm_duty`가 된다. 이를 위해 `esp_pwm_duty`의 method 패턴은 `objKind: ["pwm", "servo"]`를 허용해야 한다 — `ActionPattern.method`에 선택 항목 `objKinds?: string[]`를 두고 없으면 자기 장치 kind만.

초음파(`sensor.ts`): 블록 `esp_ultrasonic_setup`(TRIG 13, ECHO 12), lines `trig = Pin(${TRIG}, Pin.OUT)`, `echo = Pin(${ECHO}, Pin.IN)`, helper `{ name: "get_distance", params: "", body: ["trig.value(1)", "time.sleep_us(10)", "trig.value(0)", "while not echo.value():", "  pass", "start = time.ticks_us()", "while echo.value():", "  pass", "stop = time.ticks_us()", "t = time.ticks_diff(stop, start) // 2", "return int(340 * t // 10000)"] }`, kind `ultrasonic`, pattern lines `[/^trig\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.OUT\s*\)$/, /^echo\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.IN\s*\)$/]`, fields `{ TRIG, ECHO }`(핀 검사), vars `["trig", "echo"]` — **단, 도우미가 접혀야만**(Task 4의 규칙: `helpers`가 있는 준비 패턴은 같은 이름·같은 표준 본문의 `def`가 최상위에 있을 때만 접힌다; 없으면 각 줄은 다른 선언(여기서는 `esp_pin_setup`)으로 떨어진다). 값 `esp_distance` "거리 (cm)" code `get_distance()` output Number pattern `{ kind: "call", name: "get_distance", args: [] }`.
OLED(`display.ts`): `esp_oled_setup`(SCL 22, SDA 21) lines `i2c = SoftI2C(scl=Pin(${SCL}), sda=Pin(${SDA}))`, `oled = ssd1306.SSD1306_I2C(128, 64, i2c)`, helper show(a, b) body `["oled.fill(0)", "oled.text(a, 0, 20)", "oled.text(b, 0, 36)", "oled.show()"]`, kind `oled`, vars `["i2c", "oled"]`, libFiles `["ssd1306.py"]`, pattern lines 둘(`i2c = SoftI2C(scl=Pin(n), sda=Pin(m))`, `oled = ssd1306.SSD1306_I2C(128, 64, i2c)`), action `esp_oled_show` "화면에 %1 와(과) %2 보여주기" parts value A, value B(shadow "AUTO DOOR"/"Come closer" 는 툴박스에서) code `show(${A}, ${B})` pattern `{ kind: "call", name: "show", args: [null, null] }`.
print(`misc.ts`): 장치가 아니지만 같은 틀로 `id: "print", category: "pin"`… 아니다 — print는 카테고리 "핀"의 맨 아래에 두되 setup 없는 장치는 타입상 불가하므로 `DeviceSpec.setup`을 선택(`setup?: SetupSpec`)으로 바꾸고 print 장치는 setup 없이 actions 둘(`esp_print` code `print(${VALUE})` pattern call print 1인자, `esp_print2` code `print(${A}, ${B})` pattern call print 2인자). **값 입력의 빈 칸 기본값**: 생성기는 값 입력이 비면 `0`을 쓰되, check 가 없는(아무 값) 입력은 `""`을 쓴다(기존 `esp_print`·`esp_oled_show` 동작 유지).

`src/devices/registry.ts`:
```ts
import type { DeviceCategory, DeviceSpec, SetupSpec, ActionSpec, ValueSpec } from "./types";
import { pinOut, pwm /* Task 5: pinIn, adc */ } from "./specs/pin";
import { servo } from "./specs/motor";
import { ultrasonic } from "./specs/sensor";
import { oled } from "./specs/display";
import { printer } from "./specs/misc";

export const DEVICE_CATEGORIES: { id: DeviceCategory; label: string }[] = [
  { id: "pin", label: "핀" }, { id: "led", label: "LED" }, { id: "switch", label: "버튼·스위치" }, { id: "sensor", label: "센서" },
  { id: "sound", label: "소리" }, { id: "motor", label: "모터" }, { id: "display", label: "화면" }, { id: "input", label: "입력장치" },
];

/** 순서가 곧 우선순위: 같은 줄에 맞는 선언이 여럿이면 앞의 것이 접힌다 (서보 3줄 > PWM 2줄, 초음파 > 핀) */
export const DEVICES: DeviceSpec[] = [servo, pwm, ultrasonic, oled, pinOut, printer];

const byType = <T extends { blockType: string }>(items: T[]) => new Map(items.map((i) => [i.blockType, i]));
const setups = byType(DEVICES.flatMap((d) => (d.setup ? [{ ...d.setup, device: d }] : [])));
const actions = byType(DEVICES.flatMap((d) => d.actions.map((a) => ({ ...a, device: d }))));
const values = byType(DEVICES.flatMap((d) => d.values.map((v) => ({ ...v, device: d }))));
export const findSetupByBlock = (type: string): (SetupSpec & { device: DeviceSpec }) | undefined => setups.get(type);
export const findActionByBlock = (type: string): (ActionSpec & { device: DeviceSpec }) | undefined => actions.get(type);
export const findValueByBlock = (type: string): (ValueSpec & { device: DeviceSpec }) | undefined => values.get(type);
export const setupSpecs = () => [...setups.values()];
export const devicesByCategory = (c: DeviceCategory) => DEVICES.filter((d) => d.category === c);
```

- [ ] **Step 4: 블록 JSON·툴박스 산출기**

`src/devices/toBlocks.ts`:
```ts
import { DEVICES, DEVICE_CATEGORIES } from "./registry";
import type { Part } from "./types";

function arg(p: Part): Record<string, unknown> {
  switch (p.kind) {
    case "pin": return { type: "field_number", name: p.name, value: p.default, min: 0, max: 39, precision: 1 };
    case "var": return { type: "field_variable", name: p.name, variable: p.default };
    case "number": return { type: "field_number", name: p.name, value: p.default, min: p.min, max: p.max, precision: p.precision ?? 1 };
    case "dropdown": return { type: "field_dropdown", name: p.name, options: p.options };
    case "text": return { type: "field_input", name: p.name, text: p.default };
    case "colour": return { type: "field_colour", name: p.name, colour: p.default };
    case "value": return { type: "input_value", name: p.name, ...(p.check ? { check: p.check } : {}) };
  }
}
const inline = (parts: Part[]) => parts.filter((p) => p.kind === "value").length >= 2;

export function deviceBlockDefinitions(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const d of DEVICES) {
    if (d.setup) out.push({ type: d.setup.blockType, message0: d.setup.message, args0: d.setup.parts.map(arg), previousStatement: null, nextStatement: null, style: "hardware_blocks", tooltip: d.setup.tooltip });
    for (const a of d.actions) out.push({ type: a.blockType, message0: a.message, args0: a.parts.map(arg), inputsInline: inline(a.parts), previousStatement: null, nextStatement: null, style: "hardware_blocks", tooltip: a.tooltip });
    for (const v of d.values) out.push({ type: v.blockType, message0: v.message, args0: v.parts.map(arg), inputsInline: inline(v.parts), output: v.output, style: "hardware_blocks", tooltip: v.tooltip });
  }
  return out;
}

/** 툴박스 항목: 값 입력에는 shadow 로 기본값을 끼운다 */
function entry(spec: { blockType: string; parts: Part[] }) {
  const inputs: Record<string, unknown> = {};
  for (const p of spec.parts) if (p.kind === "value" && p.shadow !== undefined) {
    inputs[p.name] = typeof p.shadow === "number" ? { shadow: { type: "math_number", fields: { NUM: p.shadow } } } : { shadow: { type: "text", fields: { TEXT: p.shadow } } };
  }
  return { kind: "block", type: spec.blockType, ...(Object.keys(inputs).length ? { inputs } : {}) };
}

export function deviceToolboxCategories() {
  return DEVICE_CATEGORIES.map((c) => ({
    kind: "category", name: c.label, categorystyle: "hardware_category",
    contents: DEVICES.filter((d) => d.category === c.id).flatMap((d) => [
      { kind: "label", text: d.label },
      ...(d.setup ? [entry(d.setup)] : []), ...d.actions.map(entry), ...d.values.map(entry),
    ]),
  }));
}
```
`src/blocks/index.ts`: `esp32Blocks` 대신 `deviceBlockDefinitions()`를 `definitions`에 합치고, `registerFieldColour()`(`@blockly/field-colour` 설치)를 `registerFieldMultilineInput()` 옆에서 부른다. `src/blocks/toolbox.ts`: "ESP32" 카테고리를 지우고 함수 카테고리 뒤에 `...deviceToolboxCategories()`를 펼친다(코드 카테고리는 맨 뒤 유지). 기존 `blocks.test.ts`의 카테고리 순서 테스트는 `["시작","흐름","판단","계산","변수","함수","핀","LED","버튼·스위치","센서","소리","모터","화면","입력장치","코드"]`로 **갱신한다**(이 테스트는 레이아웃 계약이므로 바뀌는 게 맞다; 기대 문자열 불변 규칙의 예외로 보고서에 적는다).

- [ ] **Step 5: 생성기 산출기와 import 규칙**

`src/devices/toCodegen.ts`:
```ts
import type * as Blockly from "blockly";
import { Order } from "blockly/python";
import type { MicroPythonGenerator } from "@/codegen/generator";
import { DEVICES } from "./registry";
import type { Part, Values } from "./types";

/** 블록의 필드·입력을 코드 템플릿 값으로. 변수 필드는 파이썬 이름, 값 입력은 생성 코드(빈 칸은 check 유무에 따라 0 또는 "") */
function readValues(block: Blockly.Block, gen: MicroPythonGenerator, parts: Part[]): Values {
  const v: Values = {};
  for (const p of parts) {
    if (p.kind === "var") v[p.name] = gen.getVariableName(block.getFieldValue(p.name));
    else if (p.kind === "value") v[p.name] = gen.valueToCode(block, p.name, Order.NONE) || (p.check ? "0" : '""');
    else v[p.name] = String(block.getFieldValue(p.name));
  }
  return v;
}

export function registerDeviceGenerators(gen: MicroPythonGenerator): void {
  for (const d of DEVICES) {
    if (d.setup) {
      const s = d.setup;
      gen.forBlock[s.blockType] = (block, g) => {
        const G = g as MicroPythonGenerator;
        G.addSetup(...s.lines(readValues(block, G, s.parts)));
        for (const h of s.helpers ?? []) G.provideHelper(h.name, [`def ${G.FUNCTION_NAME_PLACEHOLDER_}(${h.params}):`, ...h.body.map((l) => "  " + l)]);
        return "";
      };
    }
    for (const a of d.actions) gen.forBlock[a.blockType] = (block, g) => `${a.code(readValues(block, g as MicroPythonGenerator, a.parts))}\n`;
    for (const v of d.values) gen.forBlock[v.blockType] = (block, g) => [v.code(readValues(block, g as MicroPythonGenerator, v.parts)), v.order ?? Order.FUNCTION_CALL];
  }
}
```
`src/codegen/forBlock.ts`: `esp_*` 항목, `GET_DISTANCE_BODY`, `SHOW_BODY`를 지우고 끝에서 `registerDeviceGenerators(gen)`을 부른다(`src/codegen/index.ts`의 `createGenerator`에서 불러도 된다).

`src/devices/imports.ts`:
```ts
import type { ImportRule } from "./types";
/** 생성 코드에 이 꼴이 보이면 이 import 줄이 필요하다. rank: machine 0 → ssd1306 1 → time 2 → 그 밖 3 */
export const IMPORT_RULES: ImportRule[] = [
  { when: /\bssd1306\./, line: "import ssd1306", rank: 1 },
  { when: /\btime\./, line: "import time", rank: 2 },
  // Task 5~7 이 추가: dht, math, mfrc522, KeyPad, irGetCMD, lcd128_32
];
export const MACHINE_NAMES = ["Pin", "PWM", "SoftI2C", "ADC"];
```
`src/codegen/imports.ts`의 `collectImports`: machine 이름 목록을 `MACHINE_NAMES`로, 그 뒤 `IMPORT_RULES`를 순서대로 적용해 `when`이 맞고 본문에 같은 `line`이 없으면 추가. `importRank`도 규칙의 rank를 쓴다. 새 함수 `isGeneratedImport(line: string): boolean`(파서용): `from machine import …`은 이름이 모두 `MACHINE_NAMES`에 있고 `as`가 없을 때, 그 밖에는 `IMPORT_RULES`의 `line`과 정확히 같을 때 true. `src/parser/patterns.ts`의 `isKnownImport`가 이 함수를 쓰도록 바꾼다(Task 4에서 파서 전체를 손보지만 이 한 줄은 지금 바꿔도 테스트가 유지된다).

- [ ] **Step 6: 모든 테스트 통과 확인**

Run: `npm test` → 기존 테스트 전부 PASS(카테고리 순서 테스트만 Step 4대로 갱신). `src/devices/devices.test.ts` PASS. 특히 `toolbox-roundtrip.test.ts`가 새 툴박스(카테고리 8개의 블록 전부)를 돌며 왕복에 성공해야 한다 — Task 3 시점에는 기존 14개 블록만 들어 있으므로 통과한다.
Run: `npm run build`.

- [ ] **Step 7: 커밋**

```bash
git add -A && git commit -m "장치 레지스트리 도입: 기존 ESP32 블록 14개를 선언으로 옮기고 블록·툴박스·생성기·import 를 선언에서 만든다

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 4: 파서를 레지스트리 패턴으로 일반화

**Files:**
- Create: `src/devices/subexpr.ts`, `src/parser/devices.ts`(레지스트리 매칭 도우미)
- Modify: `src/parser/context.ts`, `src/parser/index.ts`, `src/parser/statements.ts`, `src/parser/expressions.ts`, `src/parser/patterns.ts`
- Test: 기존 파서 테스트 전부 통과 + `src/parser/devices.test.ts`

**Interfaces:**
- Consumes: `DEVICES`, `setupSpecs()`, `findValueByBlock` 등(Task 3), `isGeneratedImport`.
- Produces:
  - `ParseContext.devices: Map<string, { deviceId: string; kind: string }>`(장치 변수 이름 → 장치), `ParseContext.folded: Set<string>`(도우미까지 접힌 장치 id), 기존 `pins/pwms/servos/ultrasonicFolded/oledFolded/echoPin` 삭제.
  - `matchSetupAt(texts: string[], i: number, ctx): { spec, fields: Values, consumed: number } | null`
  - `matchAction(stmtNode, ctx): BlockJson | null`, `matchValue(exprNode, ctx): BlockJson | null`
  - `parseSubExpr(text: string, ctx: ParseContext, expect?: Check): BlockJson`(`src/devices/subexpr.ts`; lezer로 `text`를 다시 파싱해 `convertExpr`에 넘긴다. 파싱 실패면 `code_expr(text)`)

- [ ] **Step 1: 테스트 작성** (`src/parser/devices.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { codeToBlocks } from "./index";
import { workspaceJsonToCode } from "@/codegen";
import { normalizeCode } from "./normalize";
import type { BlockJson } from "./types";

const body = (code: string): BlockJson[] => {
  const r = codeToBlocks(code);
  if (!r.ok) throw new Error(r.error.message);
  const start = (r.json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program");
  const out: BlockJson[] = []; let cur = start?.inputs?.BODY?.block;
  while (cur) { out.push(cur); cur = cur.next?.block; }
  return out;
};
const roundtrip = (src: string) => { const r = codeToBlocks(src); if (!r.ok) throw new Error(); return { out: workspaceJsonToCode(r.json), unparsed: r.unparsed }; };

describe("레지스트리 접기", () => {
  it("서보 3줄은 서보, PWM 2줄은 PWM, 핀 1줄은 핀으로 접힌다 (우선순위)", () => {
    const b = body("servo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)\npwm = PWM(Pin(2))\npwm.freq(1000)\nled = Pin(26, Pin.OUT)\n");
    expect(b.map((x) => x.type)).toEqual(["esp_servo_setup", "esp_pwm_setup", "esp_pin_setup"]);
  });
  it("메서드 패턴은 장치 종류를 본다: servo.duty_u16(8100) 은 문, pwm.duty_u16(8100) 은 세기", () => {
    const b = body("servo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)\npwm = PWM(Pin(2))\npwm.freq(1000)\nservo.duty_u16(8100)\npwm.duty_u16(8100)\n");
    expect(b.slice(2).map((x) => x.type)).toEqual(["esp_servo_door", "esp_pwm_duty"]);
  });
  it("도우미가 있는 준비는 표준 def 가 있을 때만 접힌다", () => {
    const withHelper = "trig = Pin(13, Pin.OUT)\necho = Pin(12, Pin.IN)\n\ndef get_distance():\n    trig.value(1)\n    time.sleep_us(10)\n    trig.value(0)\n    while not echo.value():\n        pass\n    start = time.ticks_us()\n    while echo.value():\n        pass\n    stop = time.ticks_us()\n    t = time.ticks_diff(stop, start) // 2\n    return int(340 * t // 10000)\n\nprint(get_distance())\n";
    expect(body(withHelper).map((x) => x.type)).toEqual(["esp_ultrasonic_setup", "esp_print"]);
    expect(body("trig = Pin(13, Pin.OUT)\necho = Pin(12, Pin.IN)\n").map((x) => x.type)).toEqual(["esp_pin_setup", "esp_pin_setup"]);
  });
  it("접힌 장치의 준비 줄 주석은 준비 블록 코멘트로 남는다", () => {
    const { out } = roundtrip("servo = PWM(Pin(4))  # 문\nservo.freq(50)\nservo.duty_u16(1638)\n");
    expect(out).toContain("servo = PWM(Pin(4))  # 문");
  });
  it("알려진 import 는 사라지고 다시 생긴다", () => {
    const { out, unparsed } = roundtrip("from machine import Pin\nimport time\nled = Pin(26, Pin.OUT)\ntime.sleep(1)\n");
    expect(normalizeCode(out)).toEqual(["from machine import Pin", "import time", "led = Pin(26, Pin.OUT)", "time.sleep(1)"]);
    expect(unparsed).toEqual([]);
  });
});
```
Run → 일부 FAIL(아직 하드코딩 규칙; 우선순위 테스트는 통과할 수 있다). 모두 PASS가 될 때까지 아래를 구현한다.

- [ ] **Step 2: 문맥 바꾸기**

`ParseContext`에서 `pins/pwms/servos/ultrasonicFolded/oledFolded/echoPin`을 지우고:
```ts
  /** 장치 변수 이름 → 어느 장치의 어떤 종류인지 (메서드 패턴이 objKind 로 맞춘다) */
  readonly devices = new Map<string, { deviceId: string; kind: string }>();
  /** 도우미 함수까지 표준 본문으로 확인되어 접힌 장치 id. 그 장치의 call 패턴과 def 생략이 켜진다 */
  readonly folded = new Set<string>();
  registerDevice(names: string[], deviceId: string, kind: string): void { for (const n of names) { this.devices.set(n, { deviceId, kind }); this.varId(n); } }
```
(`varId` 등록은 변수 목록 정리(`usedVariableIds`)가 뒤에서 걸러 주므로 그대로 둔다.)

- [ ] **Step 3: 매칭 도우미** (`src/parser/devices.ts`)

```ts
import type { SyntaxNode } from "@lezer/common";
import { DEVICES, setupSpecs } from "@/devices/registry";
import type { ActionPattern, DeviceSpec, SetupSpec, Values } from "@/devices/types";
import type { ParseContext } from "./context";
import { block } from "./builders";
import { callParts, convertExpr, memberParts } from "./expressions";
import { parseSubExpr } from "@/devices/subexpr";
import type { BlockJson } from "./types";

/** 최상위 문장 텍스트 texts[i..] 에 맞는 첫 준비 선언. 도우미가 있는 선언은 ctx.folded 에 그 장치가 있을 때만 */
export function matchSetupAt(texts: string[], i: number, ctx: ParseContext): { spec: SetupSpec & { device: DeviceSpec }; fields: Values; consumed: number } | null {
  for (const spec of setupSpecs()) {
    if (spec.helpers?.length && !ctx.folded.has(spec.device.id)) continue;
    const ms: RegExpExecArray[] = [];
    let ok = true;
    for (let k = 0; k < spec.pattern.lines.length; k++) {
      const m = spec.pattern.lines[k].exec(texts[i + k] ?? "");
      if (!m) { ok = false; break; }
      ms.push(m);
    }
    if (!ok) continue;
    const fields = spec.pattern.fields(ms);
    if (!fields) continue;
    return { spec, fields, consumed: spec.pattern.lines.length };
  }
  return null;
}

/** 준비 블록 JSON: 변수 필드는 { id }, 나머지는 문자열/숫자 */
export function setupBlock(spec: SetupSpec, fields: Values, ctx: ParseContext): BlockJson {
  const f: Record<string, unknown> = {};
  for (const p of spec.parts) {
    const raw = fields[p.name];
    if (p.kind === "var") f[p.name] = { id: ctx.varId(raw) };
    else if (p.kind === "pin" || p.kind === "number") f[p.name] = Number(raw);
    else f[p.name] = raw;
  }
  return block(spec.blockType, f);
}

const objKindsOf = (spec: { device: DeviceSpec; pattern: ActionPattern }) =>
  spec.pattern.kind === "method" ? (spec.pattern.objKinds ?? [spec.device.setup?.kind ?? ""]) : [];

/** 문장(ExpressionStatement 의 CallExpression) 또는 식이 레지스트리의 명령/값 패턴에 맞으면 블록으로 */
export function matchCall(expr: SyntaxNode, ctx: ParseContext, which: "actions" | "values"): BlockJson | null {
  if (expr.name !== "CallExpression") return null;
  const { callee, args, plain } = callParts(expr);
  if (!plain) return null;
  const member = memberParts(callee, ctx);
  const plainName = callee.name === "VariableName" ? ctx.src.slice(callee) : null;
  for (const d of DEVICES) for (const spec of d[which]) {
    const p = spec.pattern;
    const full = { device: d, pattern: p };
    if (p.kind === "method" && member && member.prop === p.name && args.length === p.args.length) {
      const dev = ctx.devices.get(member.obj);
      if (!dev || !objKindsOf(full).includes(dev.kind)) continue;
      const vals = literalArgsOk(p.args, args, ctx);
      if (!vals) continue;
      return build(spec, { [p.objPart]: member.obj, ...vals }, args, ctx);
    }
    if (p.kind === "call" && plainName === p.name && args.length === p.args.length && (!d.setup?.helpers?.length || ctx.folded.has(d.id) || !d.setup)) {
      const vals = literalArgsOk(p.args, args, ctx);
      if (!vals) continue;
      return build(spec, vals, args, ctx);
    }
  }
  return null;
}
```
`literalArgsOk(allowed, args, ctx)`: 각 인자에 대해 `allowed[i]`가 배열이면 인자 텍스트가 그 안에 있어야 하고(드롭다운 값으로 기록), null이면 아무 식(값 입력으로 변환). 반환 `Values`에는 드롭다운 필드 값만 담고, `build()`가 parts를 보며 `value` 부분은 `convertExpr(args[j], ctx, check)`로 채우고 `var` 부분은 `{ id }`, 드롭다운·숫자·텍스트 부분은 `Values`에서 채운다(인자 순서는 parts 중 `value`/`dropdown`(인자에 해당하는 것)의 순서와 같다 — 선언 규칙: **메서드/호출 패턴의 인자는 parts에서 `var`를 뺀 나머지 순서와 1:1**).
`expr` 패턴(값 블록): `matchExpr(node, ctx)`가 노드 텍스트에 `p.regex`를 맞추고, `objPart`가 있으면 그룹 1이 `ctx.devices`에 올바른 kind로 등록돼 있어야 한다. `values(m)`로 나머지 필드.
`lines` 패턴(명령, 연속 문장 N개): `matchActionLines(stmts: SyntaxNode[], i, ctx)` — `matchSetupAt`와 같은 방식으로 문장 텍스트(주석 뗀 `normalizeCode(...)[0]`)에 정규식을 맞추고, `objPart` 그룹의 변수가 올바른 kind이면 `values(ms)`로 필드를 만든다; 값 입력에 해당하는 필드 문자열은 `parseSubExpr`로 블록으로 바꾼다. 몸통 안(비최상위)에서도 동작해야 한다(수동 부저 4줄은 반복 안에 온다).

- [ ] **Step 4: survey·statements·expressions 를 레지스트리로**

`index.ts survey()`: (1) 기존처럼 변수·함수 표를 만든다. (2) **도우미 접기**: 최상위 `def`들 중 어떤 장치 `setup.helpers`의 모든 도우미와 이름·매개변수·표준 본문(`isStandardBody`, 2칸 들여쓰기를 뗀 본문 줄)이 일치하고 그 장치의 준비 패턴 줄들도 최상위에 연속으로 있으면 `ctx.folded.add(device.id)`하고 그 도우미 이름들을 `ctx.functions`에서 지운다. (3) 최상위 문장 텍스트를 순서대로 돌며 `matchSetupAt`가 맞는 자리마다 `ctx.registerDevice(spec.pattern.vars(ms), device.id, spec.kind)`를 미리 등록한다(메서드 패턴이 준비 줄보다 먼저 올 일은 없지만, 몸통 안의 호출이 준비 줄보다 아래에 있으므로 미리 등록해 둔다).
`statements.ts`: `AssignStatement` 최상위 분기의 하드코딩(RE_PIN_SETUP…)을 `matchSetupAt(texts, i, ctx)`로 바꾼다 — `convertStatements`가 `texts`(주석 뗀 문장 텍스트 배열)와 인덱스를 넘겨야 하므로 `convertStatement(node, following, ctx, topLevel)` 시그니처에 `texts: string[]`, `index: number`를 더한다. 접힌 준비 블록의 코멘트: 첫 줄의 줄 끝 주석은 지금처럼 `inlineComment`, 뒤따르는 줄의 주석은 Task 1 규약대로 윗줄 주석에 보탠다(`ctx.skipComments` 대신 `takeLeading`으로 모아 `withComment`). `ExpressionStatement`의 메서드/호출 분기를 `matchCall(expr, ctx, "actions")`로 바꾸되 `time.sleep*`→`flow_wait*`, `print`→`esp_print*`는 레지스트리(print 장치, 흐름은 기존 그대로)에서 온다. `FunctionDefinition`: `ctx.folded`에 든 장치의 도우미 이름이면 `none()`. `lines` 명령 패턴은 `convertStatements` 루프에서 `matchActionLines`를 먼저 시도한다.
`expressions.ts convertAny`: `CallExpression` 분기 맨 앞에서 `matchCall(node, ctx, "values")`, 그 밖의 노드는 `matchExpr(node, ctx)`를 먼저 시도한다. `OUTPUT_TYPES`에 레지스트리 값 블록의 `output`을 자동으로 합친다(`findValueByBlock`로 조회하도록 함수화).
`patterns.ts`: `RE_*`, `STANDARD_*`를 지우고 `isKnownImport = isGeneratedImport`로 바꾼다. `src/devices/subexpr.ts`: `parseSubExpr(text, ctx, expect)` — `parser.parse(text)`의 첫 문장이 `ExpressionStatement`면 그 식을 `convertExpr`로, 아니면 `codeExpr(text)`(unparsed 표시는 하지 않는다 — 조각 자체가 접힌 명령의 일부).

- [ ] **Step 5: 테스트, 커밋**

Run: `npm test`(기존 파서·왕복·코드 생성 테스트 전부 + 새 `devices.test.ts`) → PASS, `npm run build`.
```bash
git add -A && git commit -m "파서를 장치 레지스트리 패턴으로 일반화 (준비 줄 묶음·메서드·도우미 호출·식 정규식)

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### 장치 선언 공통 규칙 (Task 5~7)

- 각 장치는 `src/devices/specs/<category>.ts`에 `export const <id>: DeviceSpec` 하나. `registry.ts`의 `DEVICES` 순서는 아래 표의 "우선순위" 열대로(같은 준비 줄을 공유하는 선언은 더 구체적인 것이 앞).
- 준비 블록 메시지 꼴: "<장치>을(를) 핀 %n 에 준비하고 %m 이름 붙이기" (변수 필드가 있는 경우) / "<장치> 준비하기 (… 핀 %n)" (고정 이름인 경우).
- 핀 필드는 `kind: "pin"`(0~39). `inputOnly: true`인 핀 필드(아날로그)는 계획 2B 검사에서 34~39 외의 핀도 허용하되 경고용 표식으로만 쓴다.
- 패턴 정규식은 공백을 `\s*`로 느슨하게, 숫자는 `(\d+)`, 이름은 `(\w+)`. `fields`는 핀 유효성(`validPins`)을 검사해 실패 시 `null`.
- 메서드/호출 패턴의 인자 순서는 `parts`에서 `var`를 뺀 순서와 1:1.
- 값 블록 `output`: 숫자 `"Number"`, 참/거짓 `"Boolean"`, 글자 `"String"`, 모르면 `null`.
- 도우미 본문은 2칸 단위 들여쓰기 배열. 표의 코드 블록은 실제 생성 결과(4칸)로 적었으니 2칸으로 바꿔 넣는다.
- 테스트 규칙(각 Task): (1) `src/devices/specs/<category>.test.ts`에 장치마다 "준비 + 명령/값 한 번씩"을 담은 작업판 JSON → `workspaceJsonToCode` 기대 문자열(표의 코드) 테스트; (2) 같은 코드를 `codeToBlocks`로 되돌려 블록 type 열이 같고 `unparsed`가 0; (3) `toolbox-roundtrip.test.ts`가 자동으로 새 블록 전부를 돈다.
- import 규칙 추가는 `src/devices/imports.ts`의 `IMPORT_RULES`에. 라이브러리 파일은 `libFiles`에.

### Task 5: 장치 그룹 A — 핀 입력·아날로그, LED, 버튼·스위치

**Files:** `src/devices/specs/pin.ts`(추가), `src/devices/specs/led.ts`, `src/devices/specs/switch.ts`, `src/devices/registry.ts`, `src/devices/imports.ts`, 테스트 `src/devices/specs/pin.test.ts`, `led.test.ts`, `switch.test.ts`

| 우선순위·id | 카테고리/라벨 | 준비 블록 (type · 메시지 · parts) | 준비 줄 / 도우미 / kind / 패턴 | 명령·값 블록 (type · 메시지 · parts → 코드 · 패턴 · output · range) |
|---|---|---|---|---|
| 10 `pin_in` | 핀 / 입력 핀 | `dev_pin_in_setup` "입력 핀 %1 을(를) %2 준비하고 %3 이름 붙이기" parts: pin PIN 14, dropdown PULL [["풀업으로","PULL_UP"],["그대로","NONE"]], var VAR "button" | lines: PULL=PULL_UP → `name = Pin(14, Pin.IN, Pin.PULL_UP)`, NONE → `name = Pin(14, Pin.IN)` / kind `pin` / 패턴 1줄 `^(\w+)\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.IN\s*,\s*Pin\.PULL_UP\s*\)$` → PULL=PULL_UP (NONE 꼴은 `esp_pin_setup`이 먼저 잡는다; `pin_in`은 `pinOut`보다 **앞**에 두어 PULL_UP 줄을 가져간다) | 값은 `esp_pin_read` 공용 |
| 12 `adc` | 핀 / 아날로그 핀 | `dev_adc_setup` "아날로그 핀 %1 을(를) 준비하고 %2 이름 붙이기" parts: pin PIN 36 (inputOnly), var VAR "adc" | `name = ADC(Pin(36))`, `name.atten(ADC.ATTN_11DB)`, `name.width(ADC.WIDTH_12BIT)` / kind `adc` / 패턴 3줄(`^(\w+)\s*=\s*ADC\(\s*Pin\(\s*(\d+)\s*\)\s*\)$`, `^(\w+)\.atten\(\s*ADC\.ATTN_11DB\s*\)$`, `^(\w+)\.width\(\s*ADC\.WIDTH_12BIT\s*\)$`, 이름 셋 같아야 함) | `dev_adc_read` "%1 값 (0~4095)" parts var VAR "adc" → `adc.read()` method read [] Number; `dev_adc_voltage` "%1 전압 (V)" → `adc.read() * 3.3 / 4095` expr 패턴 `^(\w+)\.read\(\) \* 3\.3 / 4095$` objPart VAR, Number, `order: Order.MULTIPLICATIVE` |
| 20 `led_pwm` | LED / 밝기 LED | `dev_led_pwm_setup` "밝기 조절 LED를 핀 %1 에 준비하고 %2 이름 붙이기" parts pin PIN 26, var VAR "led" | `led = PWM(Pin(26))`, `led.freq(1000)` / kind `pwm` / 패턴: PWM 2줄과 같지만 freq가 1000 고정 → **`pwm`보다 앞**에 두고 fields에서 freq==="1000"일 때만 접음 (아니면 null → pwm 선언이 잡는다) | `dev_led_brightness` "%1 밝기를 %2 % 로" parts var VAR "led", value PCT Number shadow 50 → `led.duty(int(50 * 1023 / 100))` method duty [null] (인자 식 `int(x * 1023 / 100)`은 `parseSubExpr`가 calc_int(calc_arith…)로 바꾸므로 왕복 시 `dev_pwm_duty10` + 계산 블록이 된다; **이 블록 자체로 되돌리려면** 패턴을 `lines` 1줄 `^(\w+)\.duty\(int\((.+) \* 1023 / 100\)\)$`로 두고 values에서 PCT를 그룹 2로 — 이 방식을 쓴다) range PCT [0,100]; `dev_pwm_duty10` "%1 세기를 %2 로 정하기 (0~1023)" parts var VAR "led", value DUTY Number shadow 512 → `led.duty(512)` method duty [null] range DUTY [0,1023] (`objKinds: ["pwm"]`, `pwm` 장치 kind도 pwm이므로 PWM 핀에서도 쓸 수 있다) |
| 21 `led` | LED / LED | 준비 블록 없음 → **`esp_pin_setup`을 LED 카테고리에도 보여 준다**: `DeviceSpec`에 `alsoIn?: DeviceCategory[]`를 두고 toolbox 산출기가 그 카테고리에도 같은 항목을 넣는다(`pinOut.alsoIn = ["led"]`). | — | `dev_led_blink` "%1 을(를) %2 초 간격으로 %3 번 깜빡이기" parts var VAR "led", value SEC Number shadow 0.5, value TIMES Number shadow 3 → `for i in range(3):\n    led.value(1)\n    time.sleep(0.5)\n    led.value(0)\n    time.sleep(0.5)` (code가 여러 줄; 생성기는 끝에 \n만 붙인다) 패턴 없음(`pattern: { kind: "none" }` — `ActionPattern`에 `none` 추가; 왕복 때 반복 블록으로 돌아오며 unparsed 0) range TIMES [1,1000] |
| 22 `rgb` | LED / RGB LED | `dev_rgb_setup` "RGB LED 준비하기 (빨강 핀 %1, 초록 핀 %2, 파랑 핀 %3)" parts pin R 27, pin G 25, pin B 26 | lines `red = PWM(Pin(27))`, `green = PWM(Pin(25))`, `blue = PWM(Pin(26))`, `red.freq(1000)`, `green.freq(1000)`, `blue.freq(1000)`; helper `set_color(r, g, b)`: `red.duty(r * 1023 // 255)` / `green.duty(g * 1023 // 255)` / `blue.duty(b * 1023 // 255)` / kind `rgb` / vars ["red","green","blue"] / 패턴 6줄(이름 고정) | `dev_rgb_set` "RGB 색 정하기 (빨강 %1 초록 %2 파랑 %3)" parts value R,G,B Number shadow 255,105,180 → `set_color(255, 105, 180)` call set_color [null,null,null] range 0~255; `dev_rgb_colour` "RGB 색 %1" parts colour COLOUR "#ff69b4" → `set_color(255, 105, 180)`(hex→10진) 패턴 `lines` 1줄 `^set_color\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$` → COLOUR hex (이 선언을 `dev_rgb_set`보다 **앞**에 두어 리터럴 셋은 색 블록으로); `dev_rgb_off` "RGB 끄기" → `set_color(0, 0, 0)` 패턴 none |
| 23 `flow_led` | LED / 흐르는 LED | `dev_flow_setup` "흐르는 LED 준비하기 (핀 목록 %1)" parts text PINS "18, 5, 14, 17, 26" | `pins = [18, 5, 14, 17, 26]`; helper `flow_leds(ms)`: `for pin in pins:` / `  led = Pin(pin, Pin.OUT)` / `  led.value(1)` / `  time.sleep_ms(ms)` / `  led.value(0)` / kind `flow` / vars ["pins"] / 패턴 1줄 `^pins\s*=\s*\[([\d,\s]+)\]$` → PINS 정규화(`"18, 5, 14, 17, 26"` 꼴로 다시 적음) | `dev_flow_run` "LED 차례로 켜기 (간격 %1 ms)" parts value MS Number shadow 100 → `flow_leds(100)` call flow_leds [null] |
| 30 `button` | 버튼·스위치 / 버튼 | `dev_button_setup` "버튼을 핀 %1 에 준비하고 %2 이름 붙이기" parts pin PIN 14, var VAR "button" | `button = Pin(14, Pin.IN, Pin.PULL_UP)` / kind `pin` / 패턴 = `pin_in`의 PULL_UP 줄과 같음 → **`pin_in`보다 앞** | `dev_button_pressed` "%1 이(가) 눌렸는가" parts var VAR "button" → `button.value() == 0` expr `^(\w+)\.value\(\) == 0$` objPart VAR (objKinds ["pin"]) Boolean `order: Order.RELATIONAL` |
| 31 `tilt` | 버튼·스위치 / 틸트 스위치 | `dev_tilt_setup` "틸트 스위치를 핀 %1 에 준비하고 %2 이름 붙이기" pin 14, var "tilt" | `tilt = Pin(14, Pin.IN)` / kind `pin` / 패턴 없음(이 줄은 `esp_pin_setup`이 잡는다 — `pattern: { lines: [], fields: () => null, vars: () => [] }` 허용; `matchSetupAt`는 lines가 비면 건너뛴다) | `dev_tilt_tilted` "%1 이(가) 기울었는가" → `tilt.value() == 1` expr `^(\w+)\.value\(\) == 1$` objKinds ["pin"] Boolean RELATIONAL |
| 32 `pir` | 버튼·스위치 / 인체감지(PIR) | `dev_pir_setup` "인체감지 센서를 핀 %1 에 준비하고 %2 이름 붙이기" pin 14, var "pir" | `pir = Pin(14, Pin.IN)` / kind `pin` / 패턴 없음 | `dev_pir_detected` "%1 에 사람이 있는가" → `pir.value() == 1` (tilt와 같은 expr 정규식이므로 **tilt 선언이 먼저** 잡는다 — 같은 식은 하나의 블록으로만 돌아와도 된다) |
| 33 `joystick` | 버튼·스위치 / 조이스틱 | `dev_joystick_setup` "조이스틱 준비하기 (X 핀 %1, Y 핀 %2, 버튼 핀 %3)" pin X 36, pin Y 39, pin Z 26 | lines `rocker_x = ADC(Pin(36))`, `rocker_y = ADC(Pin(39))`, `rocker_x.atten(ADC.ATTN_11DB)`, `rocker_y.atten(ADC.ATTN_11DB)`, `button_z = Pin(26, Pin.IN, Pin.PULL_UP)` / kind `joystick` / vars 셋 / 패턴 5줄 이름 고정 → **`adc`·`button`보다 앞** | `dev_joystick_x` "조이스틱 X 값" → `rocker_x.read()` expr `^rocker_x\.read\(\)$` Number; `dev_joystick_y` → `rocker_y.read()`; `dev_joystick_pressed` "조이스틱 버튼이 눌렸는가" → `button_z.value() == 0` expr Boolean |
| 40 `light`/`knob`/`sound`/`flame` | 센서 / 조도·가변저항·소리·불꽃 | `dev_light_setup` "조도 센서를 핀 %1 에 준비하고 %2 이름 붙이기"(var "light"), `dev_knob_setup` "가변저항을 …"(var "knob"), `dev_sound_setup` "소리 센서를 …"(var "sound"), `dev_flame_setup` "불꽃 센서를 …"(var "flame") — 모두 pin 36 | lines·kind는 `adc`와 동일(`adc`의 3줄) / 패턴 없음(`adc`가 잡는다) | 값은 `dev_adc_read` 공용 (툴박스에서 이 장치들의 `values`에 `dev_adc_read`를 다시 넣지 않고, 산출기가 **라벨 밑에 "값" 블록을 VAR 기본값만 바꿔 shadow 없이 넣도록** `DeviceSpec.extraToolbox?: { blockType: string; fields: Record<string,string> }[]` 지원: `{ blockType: "dev_adc_read", fields: { VAR: "light" } }`) |

- [ ] **Step 1~3**: 표의 장치를 선언하고(`pin.ts`에 pin_in·adc, `led.ts`, `switch.ts`, `sensor.ts`에 light/knob/sound/flame), `registry.ts` 순서를 우선순위대로 고치고, `IMPORT_RULES`는 변경 없음(ADC는 `MACHINE_NAMES`로 처리). `ActionPattern`에 `none`과 `objKinds`, `DeviceSpec`에 `alsoIn`·`extraToolbox`를 추가한다(Task 3 타입 확장).
- [ ] **Step 4**: 테스트 — 장치마다 생성 코드 기대 문자열(예: 버튼 준비 + 눌렸는가를 `if` 조건에 넣은 프로그램이 `button = Pin(14, Pin.IN, Pin.PULL_UP)` … `if button.value() == 0:`을 내는지), 왕복 블록 type 열, unparsed 0. `dev_led_brightness` 왕복이 자기 블록으로 돌아오는지. `dev_rgb_colour` "#ff69b4" → `set_color(255, 105, 180)` → 다시 `dev_rgb_colour` "#ff69b4".
- [ ] **Step 5**: `npm test && npm run build` → 커밋 "장치 그룹 A: 입력 핀·아날로그, LED·RGB·흐르는 LED, 버튼·틸트·PIR·조이스틱".

---

### Task 6: 장치 그룹 B — 센서(DHT11·서미스터·LM35), 소리, 모터

**Files:** `src/devices/specs/sensor.ts`, `sound.ts`, `motor.ts`, `imports.ts`, 테스트 `sensor.test.ts`, `sound.test.ts`, `motor.test.ts`

| 우선순위·id | 카테고리/라벨 | 준비 블록 | 준비 줄 / 도우미 / kind / 패턴 / import·lib | 명령·값 블록 |
|---|---|---|---|---|
| 41 `dht11` | 센서 / 온습도(DHT11) | `dev_dht_setup` "온습도 센서(DHT11)를 핀 %1 에 준비하고 %2 이름 붙이기" pin 13, var "dht11" | `dht11 = dht.DHT11(Pin(13))` / kind `dht` / 패턴 1줄 `^(\w+)\s*=\s*dht\.DHT11\(\s*Pin\(\s*(\d+)\s*\)\s*\)$` / import 규칙 `{ when: /\bdht\./, line: "import dht", rank: 3 }` | `dev_dht_measure` "%1 측정하기" var → `dht11.measure()` method measure []; `dev_dht_temp` "%1 온도 (℃)" → `dht11.temperature()` method Number; `dev_dht_hum` "%1 습도 (%)" → `dht11.humidity()` method Number |
| 42 `ntc` | 센서 / 온도(서미스터) | `dev_ntc_setup` "서미스터를 핀 %1 에 준비하고 %2 이름 붙이기" pin 36, var "ntc" | `ntc = ADC(Pin(36))`, `ntc.atten(ADC.ATTN_11DB)`, `ntc.width(ADC.WIDTH_12BIT)`; helper `ntc_temperature()`: `v = ntc.read() / 4095 * 3.3` / `r = 10 * v / (3.3 - v)` / `return 1 / (math.log(r / 10) / 3950 + 1 / 298.15) - 273.15` / kind `adc` / 패턴 = adc 3줄 + 도우미(이름 `ntc` 고정: fields에서 m[1]==="ntc"일 때만) → **`adc`보다 앞** / import `{ when: /\bmath\./, line: "import math", rank: 3 }` | `dev_ntc_temp` "서미스터 온도 (℃)" → `ntc_temperature()` call Number |
| 43 `lm35` | 센서 / 온도(LM35) | `dev_lm35_setup` "LM35 온도 센서를 핀 %1 에 준비하기" pin 36 | `lm35 = ADC(Pin(36))`, `lm35.atten(ADC.ATTN_11DB)`, `lm35.width(ADC.WIDTH_12BIT)`; helper `lm35_temperature()`: `return lm35.read() * 330 / 4095` / kind `adc` / 패턴 adc 3줄(이름 `lm35`) + 도우미 → `adc`보다 앞 | `dev_lm35_temp` "LM35 온도 (℃)" → `lm35_temperature()` call Number |
| 50 `buzzer_active` | 소리 / 능동 부저 | `dev_buzzer_setup` "부저를 핀 %1 에 준비하고 %2 이름 붙이기" pin 15, var "buzzer" | `buzzer = Pin(15, Pin.OUT)` / kind `pin` / 패턴 없음(`esp_pin_setup`이 잡는다) | 켜기·끄기는 `esp_pin_write` 공용(`extraToolbox: [{ blockType: "esp_pin_write", fields: { VAR: "buzzer" } }]`) |
| 51 `buzzer_passive` | 소리 / 수동 부저(음) | `dev_beeper_setup` "소리 나는 부저를 핀 %1 에 준비하고 %2 이름 붙이기" pin 15, var "beeper" | `beeper = PWM(Pin(15))`, `beeper.freq(440)`, `beeper.duty(0)` / kind `beeper` / 패턴 3줄(`duty(0)` 고정) → **`pwm`보다 앞** | `dev_beeper_tone` "%1 로 %2 Hz 음을 %3 초 울리기" var VAR, value HZ Number shadow 440, value SEC Number shadow 0.5 → `beeper.freq(440)\nbeeper.duty(512)\ntime.sleep(0.5)\nbeeper.duty(0)` 패턴 `lines` 4줄 (`^(\w+)\.freq\((.+)\)$`, `^(\w+)\.duty\(512\)$`, `^time\.sleep\((.+)\)$`, `^(\w+)\.duty\(0\)$`, 이름 같고 objKind beeper) values HZ=그룹, SEC=그룹 (parseSubExpr) range HZ [20, 20000]; `dev_beeper_note` "%1 로 %2 음을 %3 박 울리기" var VAR, dropdown NOTE [["도(C4)","262"],["레(D4)","294"],["미(E4)","330"],["파(F4)","349"],["솔(G4)","392"],["라(A4)","440"],["시(B4)","494"],["높은 도(C5)","523"]], value BEAT Number shadow 1 → `beeper.freq(262)\nbeeper.duty(512)\ntime.sleep(1 * 0.5)\nbeeper.duty(0)` 패턴 none(왕복 시 tone 블록으로 돌아온다 — tone의 4줄 패턴이 `time.sleep(1 * 0.5)`도 그룹으로 받는다); `dev_beeper_stop` "%1 소리 멈추기" → `beeper.duty(0)` method duty [["0"]] |
| 61 `servo` (기존) | 모터 / 서보 모터 | 기존 | 기존 | 기존 둘 + `dev_servo_angle` "%1 각도를 %2 도로" var VAR "servo", value ANGLE Number shadow 90 → `servo.duty_u16(1638 + 90 * 6462 // 180)` 패턴 `lines` 1줄 `^(\w+)\.duty_u16\(1638 \+ (.+) \* 6462 // 180\)$` objKind servo, ANGLE=그룹 2 range ANGLE [0,180] |
| 62 `dc_motor` | 모터 / DC 모터 | `dev_motor_setup` "DC 모터 준비하기 (IN+ 핀 %1, IN- 핀 %2)" pin A 13, pin B 12 | `motor1a = PWM(Pin(13))`, `motor1b = PWM(Pin(12))`, `motor1a.freq(1000)`, `motor1b.freq(1000)`; helpers `forward(speed)`: `motor1a.duty(speed)` / `motor1b.duty(0)`; `backward(speed)`: `motor1a.duty(0)` / `motor1b.duty(speed)`; `stop()`: `motor1a.duty(0)` / `motor1b.duty(0)` / kind `motor` / vars 둘 / 패턴 4줄 이름 고정 → `pwm`보다 앞 | `dev_motor_forward` "모터 앞으로 (속도 %1)" value SPEED Number shadow 1023 → `forward(1023)` call [null] range [0,1023]; `dev_motor_backward` "모터 뒤로 (속도 %1)" → `backward(1023)`; `dev_motor_stop` "모터 정지" → `stop()` call [] |
| 63 `relay` | 모터 / 릴레이 | `dev_relay_setup` "릴레이를 핀 %1 에 준비하고 %2 이름 붙이기" pin 16, var "relay" | `relay = Pin(16, Pin.OUT)` / kind `pin` / 패턴 없음 | 켜기·끄기 `esp_pin_write` 공용(extraToolbox VAR relay) |

- [ ] 선언·레지스트리 순서·import 규칙·테스트(장치별 생성 코드 기대 문자열 + 왕복 + unparsed 0; 수동 부저 tone 4줄 왕복이 자기 블록으로 돌아오는지; note 블록이 tone으로 돌아오는지; 서보 각도 왕복) → `npm test && npm run build` → 커밋 "장치 그룹 B: DHT11·서미스터·LM35, 능동·수동 부저, 서보 각도·DC 모터·릴레이".

---

### Task 7: 장치 그룹 C — 화면·입력장치, 라이브러리 동봉, 마무리

**Files:** `src/devices/specs/display.ts`, `input.ts`, `imports.ts`, `public/lib/*.py`, `public/lib/README.md`, `README.md`, 테스트 `display.test.ts`, `input.test.ts`, `src/devices/libfiles.test.ts`

| 우선순위·id | 카테고리/라벨 | 준비 블록 | 준비 줄 / 도우미 / kind / 패턴 / import·lib | 명령·값 블록 |
|---|---|---|---|---|
| 70 `oled` (기존) | 화면 / OLED | 기존 | 기존 + libFiles ["ssd1306.py"] | 기존 `esp_oled_show` + `dev_oled_text` "OLED에 %1 을(를) (x %2, y %3) 에 적기" value TEXT shadow "hello", value X Number shadow 0, value Y Number shadow 0 → `oled.text("hello", 0, 0)` method text [null,null,null] (objKind oled, obj 이름 `oled` 고정이므로 `objPart` 없이 `objName: "oled"` — `method` 패턴에 `objName?: string` 추가); `dev_oled_clear` "OLED 지우기" → `oled.fill(0)` method fill [["0"]]; `dev_oled_update` "OLED 화면에 내보내기" → `oled.show()` method show []; `dev_oled_line` "OLED 선 (%1,%2) 에서 (%3,%4) 까지" 4 value Number → `oled.line(0, 0, 127, 63, 1)` method line [null,null,null,null,["1"]]; `dev_oled_rect` "OLED 사각형 (x %1, y %2, 너비 %3, 높이 %4)" → `oled.rect(0, 0, 40, 20, 1)` method rect |
| 71 `lcd` | 화면 / LCD 128×32 | `dev_lcd_setup` "LCD 128×32 준비하기 (sda 핀 %1, scl 핀 %2, 주소 %3)" pin SDA 21, pin SCL 22, text ADDR "0x3f" | `lcd = lcd128_32(21, 22, 0, 0x3f)`, `lcd.Init()`, `lcd.Clear()` / kind `lcd` / vars ["lcd"] / 패턴 3줄 / import `{ when: /\blcd128_32\(/, line: "from lcd128_32 import lcd128_32", rank: 3 }`, `{ when: /\blcd128_32\(/, line: "import lcd128_32_fonts", rank: 3 }` / libFiles ["lcd128_32.py", "lcd128_32_fonts.py"] | `dev_lcd_text` "LCD %1 줄 %2 칸에 %3 적기" value ROW Number shadow 0, value COL Number shadow 0, value TEXT shadow "hello" → `lcd.Cursor(0, 0)\nlcd.Display("hello")` 패턴 lines 2줄 (`^lcd\.Cursor\((.+), (.+)\)$`, `^lcd\.Display\((.+)\)$`); `dev_lcd_clear` "LCD 지우기" → `lcd.Clear()` method |
| 72 `seg7` | 화면 / 7세그먼트 | `dev_seg_setup` "7세그먼트 준비하기 (SI 핀 %1, RCK 핀 %2, SCK 핀 %3)" pin 5, 23, 18 | `si = Pin(5, Pin.OUT)`, `rck = Pin(23, Pin.OUT)`, `sck = Pin(18, Pin.OUT)`, `SEGCODE = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f]`; helpers `hc595_shift(dat)`: `rck.value(0)` / `for bit in range(7, -1, -1):` / `  value = 1 & (dat >> bit)` / `  sck.value(0)` / `  si.value(value)` / `  sck.value(1)` / `rck.value(1)`; `show_digit(n, dot)`: `hc595_shift(SEGCODE[n] | (0x80 if dot else 0))` / kind `seg7` / vars ["si","rck","sck","SEGCODE"] / 패턴 4줄 (SEGCODE 줄은 `^SEGCODE\s*=\s*\[.*\]$`) → `pinOut`보다 앞 | `dev_seg_digit` "7세그먼트에 숫자 %1 표시 (점 %2)" value N Number shadow 3, dropdown DOT [["끄기","False"],["켜기","True"]] → `show_digit(3, False)` call [null, ["False","True"]] range N [0,9]; `dev_seg_clear` "7세그먼트 지우기" → `hc595_shift(0)` call [["0"]] |
| 80 `rfid` | 입력장치 / RFID | `dev_rfid_setup` "RFID 준비하기 (scl 핀 %1, sda 핀 %2, 주소 %3)" pin 22, pin 21, text ADDR "0x28" | `rc522 = mfrc522(22, 21, 0x28)`, `rc522.PCD_Init()`; helpers `card_present()`: `return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()`; `card_uid()`: `return rc522.uid.uidByte[0:rc522.uid.size]` / kind `rfid` / vars ["rc522"] / 패턴 2줄 / import `{ when: /\bmfrc522\(/, line: "from mfrc522_i2c import mfrc522", rank: 3 }` / libFiles ["mfrc522_i2c.py","mfrc522_config.py","soft_iic.py"] | `dev_rfid_present` "카드가 있는가" → `card_present()` call Boolean; `dev_rfid_uid` "카드 번호" → `card_uid()` call output null |
| 81 `keypad` | 입력장치 / 키패드 | `dev_keypad_setup` "4×4 키패드 준비하기 (행 핀 %1 %2 %3 %4, 열 핀 %5 %6 %7 %8)" pin R1~R4 26,25,17,16, C1~C4 27,14,12,13 | `keypad = KeyPad(26, 25, 17, 16, 27, 14, 12, 13)` / kind `keypad` / 패턴 1줄 / import `{ when: /\bKeyPad\(/, line: "from keypad import KeyPad", rank: 3 }` / libFiles ["keypad.py"] | `dev_keypad_key` "눌린 키" → `keypad.scan()` method scan [] output null |
| 82 `ir` | 입력장치 / IR 리모컨 | `dev_ir_setup` "IR 수신기를 핀 %1 에 준비하기" pin 5 | `ir = irGetCMD(5)` / kind `ir` / 패턴 1줄 / import `{ when: /\birGetCMD\(/, line: "from irrecvdata import irGetCMD", rank: 3 }` / libFiles ["irrecvdata.py"] | `dev_ir_value` "리모컨에서 받은 값" → `ir.ir_read()` method output null |

- [ ] **라이브러리 동봉**: `curl -L -o /tmp/ks-lib.zip "https://docs.keyestudio.com/projects/KS5020/en/latest/_downloads/aa55cec3f54bf29d6d697256c354e3bd/Library.zip"` → `Library/MicroPython_Library/*.py` 9개를 `public/lib/`에 복사, `public/lib/README.md`에 출처(Keyestudio KS5020 Library.zip)와 파일 목록. 테스트 `src/devices/libfiles.test.ts`: 레지스트리의 모든 `libFiles`가 `public/lib/`에 존재한다. `src/devices/registry.ts`에 `libFilesFor(blockTypes: string[]): string[]`(계획 2C가 쓴다).
- [ ] **README** 모듈 설명에 `src/devices` 추가(장치 선언 → 블록·생성기·파서·라이브러리가 나오는 흐름, 장치 추가 방법 5줄).
- [ ] 테스트(생성 코드·왕복·unparsed 0, 특히 `toolbox-roundtrip.test.ts`가 전체 블록을 돌며 통과), `npm test && npm run build && npm run test:e2e` → 커밋 "장치 그룹 C: OLED 확장·LCD·7세그먼트·RFID·키패드·IR, 라이브러리 동봉" → `git push` → Pages 배포 확인.

## 계획 2A 완료 조건

- 배포된 자유 코딩 화면에서 팔레트 스크롤바가 남지 않고, 좁은 창에서 탭 레이아웃이 되며, 하드웨어 카테고리 8개(핀·LED·버튼·스위치·센서·소리·모터·화면·입력장치)에 위 표의 블록이 모두 보인다.
- `npm test`(레지스트리 전체 왕복 포함)·`npm run test:e2e` 통과.
- 다음: 계획 2B(검사 엔진·코드 지도·문제/콘솔 패널·양방향 이동), 계획 2C(보드 연결).
