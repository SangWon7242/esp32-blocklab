# ESP32 블록랩

블록과 MicroPython 코드를 양방향으로 오가며 ESP32를 배우는 교육용 웹앱입니다. 블록을 놓으면 코드가 바뀌고, 코드를 고치면 블록이 따라옵니다.

배포 주소: https://sangwon7242.github.io/esp32-blocklab/ (자유 코딩 화면: https://sangwon7242.github.io/esp32-blocklab/#/lab)

`main` 에 push 하면 GitHub Actions 가 테스트·빌드 뒤 GitHub Pages 에 배포합니다.

## 실행 방법

Node 22 이상이 필요합니다. 다음 단계에서 들어올 보드 연결(Web Serial)에는 Chrome 이 필요합니다 (Edge 같은 Chromium 계열 브라우저도 됩니다).

```bash
npm i
npm run dev
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 배포용 빌드 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:e2e` | 브라우저 테스트 (Playwright) |
| `npm run typecheck` | 타입 검사 |

## 폴더 구조

```
src/
  main.tsx                 진입점
  index.css                Tailwind와 shadcn 테마
  app/
    App.tsx                헤더와 HashRouter 라우트 (#/, #/lab)
    pages/HomePage.tsx     시작 화면
    lab/
      LabPage.tsx          자유 코딩 화면 (블록·코드 탭, 코드 패널, 보드 버튼 자리)
      editorSync.ts        블록 ↔ 코드 동기화 리듀서
      sample.ts            처음 깔리는 예시 코드
  blocks/
    index.ts               registerBlocks(), 블록 type 목록
    definitions/           시작·흐름·계산·코드 블록 정의 (JSON)
    toolbox.ts             카테고리 툴박스 (하드웨어 카테고리는 src/devices 가 만든다)
    theme.ts, colors.ts    엔트리 색 테마
    messages.ts            한국어 문구
    names.ts               파이썬 키워드, 변수 이름 검사
  codegen/
    index.ts               createGenerator(), generateCode(), workspaceJsonToCode()
    generator.ts           MicroPythonGenerator (준비 줄 끌어올리기, 주석, import)
    forBlock.ts            블록별 코드 생성
    imports.ts             필요한 import 계산과 모으기
  devices/
    types.ts               장치 선언 타입 (DeviceSpec: 준비·명령·값 블록, 패턴, 라이브러리)
    registry.ts            DEVICES (파서 우선순위 순), 블록 type 으로 찾기, libFilesFor()
    specs/                 장치 선언: pin·led·switch·sensor·sound·motor·display·input·misc
    toBlocks.ts            선언 → Blockly 블록 JSON·하드웨어 툴박스 카테고리
    toCodegen.ts           선언 → 블록별 코드 생성기
    imports.ts             import 규칙 (IMPORT_RULES, MACHINE_NAMES)
    testkit.ts             장치 테스트 도우미 (블록 → 코드 → 블록)
  parser/
    index.ts               codeToBlocks(), normalizeCode()
    statements.ts          문장 → 블록 (주석 줄 붙이기 포함)
    expressions.ts         식 → 값 블록
    devices.ts             레지스트리 패턴으로 장치 블록 맞추기
    patterns.ts            표준 함수 모양 판별
    context.ts, builders.ts, tree.ts, normalize.ts, types.ts
  components/
    editor/
      BlocklyWorkspace.tsx Blockly 작업판 (React 래퍼)
      CodePanel.tsx        CodeMirror 코드 패널
      echoGuard.ts         늦게 돌아온 메아리로 입력을 덮지 않게
      namePrompt.ts        변수 이름 입력 창
    ui/                    shadcn/ui 컴포넌트
  lib/utils.ts             cn() 유틸
content/chapters/          수업 코드 (왕복 테스트에 씀)
e2e/                       Playwright 브라우저 테스트
public/favicon.svg         아이콘
public/lib/                보드에 올리는 장치 라이브러리 (.py, 출처는 public/lib/README.md)
.github/workflows/deploy.yml   GitHub Pages 배포
docs/                      설계 문서와 구현 계획
```

## 모듈

**`src/blocks` — 블록 정의.** 커스텀 블록(시작·흐름·계산·ESP32·코드)을 JSON 으로 정의하고, 엔트리 색 테마(`entryTheme`)와 카테고리 툴박스(`toolbox`)를 냅니다. 쓰기 전에 `registerBlocks()` 를 한 번 부르면 한국어 문구를 적용하고 블록을 등록합니다(여러 번 불러도 안전). 변수 꾸러미가 수업 코드에 없는 꼴을 내는 `math_change`·`procedures_ifreturn` 은 여기서 뺍니다. `isValidPythonName()`·`PYTHON_KEYWORDS` 로 변수 이름을 검사합니다. 의존: `blockly`, `@blockly/field-multilineinput`. React 는 쓰지 않습니다.

**`src/codegen` — 블록 → MicroPython.** `MicroPythonGenerator` 는 Blockly 의 `PythonGenerator` 를 이어받아 수업 저장소 코드 모양(4칸 들여쓰기, import → 준비 줄 → 함수 → 본문)으로 씁니다. 준비 블록은 코드 맨 위로 끌어올리고, 블록 코멘트는 문장 위 `#` 줄과 줄 끝 `#` 주석으로 되돌립니다. 주로 `generateCode(workspace)`(그려진 작업판)와 `workspaceJsonToCode(json)`(헤드리스, 테스트·동기화용)를 씁니다. 의존: `blockly`, `src/blocks`. React 는 쓰지 않습니다.

**`src/parser` — MicroPython → 블록.** `codeToBlocks(code)` 가 `@lezer/python` 으로 코드를 읽어 Blockly 작업판 JSON 을 돌려줍니다(`{ ok, json, unparsed }` 또는 `{ ok: false, error: { line, message } }`). 먼저 전체를 훑어(survey) 변수·장치·함수 표와 도우미 함수가 있는 장치의 접기 여부를 정한 뒤 문장을 블록으로 바꾸고, 블록으로 옮기면 뜻이 바뀌거나 사라질 구문은 `code_stmt`/`code_expr` 로 남겨 `unparsed` 에 적습니다. `normalizeCode()` 는 주석·빈 줄을 뺀 줄 배열로 왕복 비교에 씁니다. 의존: `@lezer/python`, `@lezer/common` (Blockly 는 타입만, React 없음).

**`src/devices` — 장치 레지스트리.** 하드웨어 장치마다 선언(`DeviceSpec`) 하나를 `specs/*.ts` 에 적으면, 그 선언에서 블록 JSON·툴박스 항목(`toBlocks.ts`), 코드 생성기(`toCodegen.ts`), 파서가 코드를 블록으로 되돌리는 패턴(`src/parser/devices.ts` 가 사용), 필요한 import(`imports.ts`)와 보드 라이브러리 목록(`libFilesFor()`, 파일은 `public/lib/`)이 모두 나옵니다. 선언에는 준비 블록(준비 줄·도우미 함수·`kind`·준비 줄 패턴·`libFiles`), 명령·값 블록(메시지·칸·코드 템플릿·`method`/`call`/`lines`/`expr` 패턴)이 들어갑니다. `DEVICES` 의 순서는 같은 줄에 맞는 선언이 여럿일 때의 우선순위이고, 툴박스 안 순서는 `toolboxOrder` 로 따로 정합니다. Blockly 는 생성기 쪽(`toCodegen.ts`)만 씁니다.

장치를 하나 더하는 방법:

1. `src/devices/specs/<카테고리>.ts` 에 `DeviceSpec` 을 적는다 (블록 type, 한국어 메시지, 칸, 코드 템플릿, 패턴, `toolboxOrder`).
2. `src/devices/registry.ts` 의 `DEVICES` 에 넣는다. 더 일반적인 선언(예: 출력 핀 1줄)과 줄이 겹치면 그보다 앞에 둔다.
3. 새 모듈을 import 하면 `src/devices/imports.ts` 의 `IMPORT_RULES` 에 규칙을, 보드 라이브러리가 필요하면 `public/lib/` 에 파일을 넣고 `libFiles` 에 적는다.
4. `specs/<카테고리>.test.ts` 에 생성 코드와 왕복(코드 → 블록 → 같은 코드, unparsed 0) 테스트를 쓴다.
5. `npm test` — `src/blocks/toolbox-roundtrip.test.ts` 가 툴박스의 새 블록까지 모두 왕복해 본다.

**`src/components/editor` — 편집기 컴포넌트.** `BlocklyWorkspace` 는 Blockly 를 띄우고 ref 로 `load(json)`·`getJson()`·`getCode()` 를 내놓으며, 사용자가 블록을 바꿀 때마다 `onChange(json, code)` 를 부릅니다(떨어진 블록 끄기, 시작 블록 하나, 변수 이름 창 포함). `CodePanel` 은 CodeMirror 6 코드 패널로 `value`·`readOnly`·`onChange`·`errorLine` 을 받습니다. 의존: React, `blockly`, CodeMirror, `src/blocks`·`src/codegen`.

**`src/app/lab` — 자유 코딩 화면.** `LabPage` 가 블록/코드 탭, 작업판, 코드 패널을 묶고, `editorReducer`(`editorSync.ts`)가 어느 쪽이 기준인지(`source`)와 코드·블록·변환 못 한 줄·문법 오류를 들고 있습니다. 블록 모드에서는 블록이 바뀔 때마다 코드를, 코드 모드에서는 입력 300ms 뒤 파싱한 블록을 갱신합니다. 문법 오류가 남아 있으면 블록 탭으로 넘어가지 않습니다. 의존: `src/components/editor`, `src/codegen`, `src/parser`, shadcn/ui, `sonner`.

## 문서

- [설계 문서](docs/superpowers/specs/2026-10-13-esp32-blocklab-design.md)
- [구현 계획 1: 편집기 코어](docs/superpowers/plans/2026-10-13-plan1-editor-core.md)
