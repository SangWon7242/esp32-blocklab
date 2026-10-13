# ESP32 블록랩 — 계획 1: 편집기 코어 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 블록 ↔ MicroPython 양방향 편집기(자유 코딩 화면)를 GitHub Pages에 배포 가능한 상태로 만든다.

**Architecture:** Vite + React 정적 SPA. Blockly 13(Zelos 렌더러, 엔트리 색 테마)로 블록을 편집하고, `PythonGenerator`를 상속한 생성기가 수업 저장소 코드와 같은 모양의 MicroPython을 만든다. `@lezer/python` 파스 트리를 Blockly 직렬화 JSON으로 바꾸는 파서가 역변환을 맡고, 변환 불가 줄은 `code_stmt`/`code_expr` 블록에 담아 왕복을 보장한다. 보드 연결(계획 2)과 트랙(계획 3)은 별도 계획이다.

**Tech Stack:** Vite 8, React 19, TypeScript 6, Tailwind 4, shadcn/ui(radix, nova 프리셋), lucide-react, Blockly 13.3, CodeMirror 6, @lezer/python, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-esp32-blocklab-design.md`

## Global Constraints

- 아이콘은 `lucide-react`만 쓴다. 이모지는 코드·문구·커밋 메시지 어디에도 넣지 않는다.
- UI 컴포넌트는 `src/components/ui/`의 shadcn 컴포넌트를 쓴다. 직접 만든 버튼·카드 금지.
- 생성 코드는 들여쓰기 4칸, 문자열은 큰따옴표, 수업 저장소(`SangWon7242/esp32-micropython-class`) 코드와 같은 줄 구성을 목표로 한다.
- `src/app/` 밖의 모듈(`blocks`, `codegen`, `parser`)은 React에 의존하지 않는다. `parser`는 Blockly에도 의존하지 않는다.
- 문구는 한국어, 학생 언어(지도안의 말투). 변수·함수 이름은 영어.
- 각 Task는 `npm test`(Vitest)와 `npm run build`가 통과한 상태로 커밋한다. 커밋 메시지는 한국어 한 줄 요약 + 본문, 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 작업 폴더: `/Users/lucas/works/python_projects/esp32-blocklab` (이미 git 초기화, 설계 문서 커밋됨).
- Node 22, npm 10. Chrome 설치됨.

## 사전 확인된 사실 (조사 결과, 그대로 믿고 쓰면 됨)

- `npx -y shadcn@latest init -b radix -p nova -y --no-rtl --pointer -s < /dev/null` 은 프롬프트 없이 끝난다. `components.json`(style `radix-nova`, iconLibrary `lucide`, css `src/index.css`)과 `src/lib/utils.ts`(`export { cn } from "cn"`)를 만들고 `cn`, `radix-ui`, `class-variance-authority`, `tw-animate-css`, `next-themes` 등을 설치한다.
- `npx -y shadcn@latest add -y -s <names> < /dev/null` 로 컴포넌트를 추가한다. `resizable`은 `react-resizable-panels` v4(`Group`, `Panel`, `Separator`)를, `sonner`는 `next-themes`를 쓴다.
- Blockly 13.3: `import * as Blockly from 'blockly'`, `import {pythonGenerator, PythonGenerator, Order} from 'blockly/python'`, `import * as Ko from 'blockly/msg/ko'`. Node(Vitest)에서 `new Blockly.Workspace()` + `Blockly.serialization.workspaces.load(json, ws)` + `generator.workspaceToCode(ws)` 가 DOM 없이 동작한다(확인함).
- `new PythonGenerator('name')`의 `forBlock`은 비어 있다. `Object.assign(gen.forBlock, pythonGenerator.forBlock)` 으로 내장 생성기를 복사해야 한다.
- 내장 `PythonGenerator.init`은 모든 변수에 `x = None` 선언을 `definitions_['variables']`에 넣는다 → 삭제해야 한다. 내장 `procedures_defnoreturn/defreturn` 생성기는 함수 안에 `global led, d` 줄을 넣는다 → 덮어써야 한다. 내장 `text` 생성기는 작은따옴표를 쓴다 → 덮어써야 한다. `scrub_`는 블록 코멘트를 **앞 줄** `# ...` 로 낸다 → 줄 끝 주석으로 덮어쓴다.
- Blockly 직렬화 JSON 형식(확인함):
  - 변수: 최상위 `variables: [{name:'led', id:'var_led'}]`, 필드 참조는 `fields: {VAR: {id:'var_led'}}`.
  - 함수 정의: `{type:'procedures_defnoreturn', extraState:{params:[{name:'t', id:'var_t'}]}, fields:{NAME:'blink'}, inputs:{STACK:{block:...}}}`. 반환형은 `procedures_defreturn` + `inputs.RETURN`.
  - 함수 호출: `{type:'procedures_callnoreturn', extraState:{name:'blink', params:['t']}, inputs:{ARG0:{block:...}}}`. 값형은 `procedures_callreturn`.
  - 조건: `{type:'controls_if', extraState:{elseIfCount:1, hasElse:true}, inputs:{IF0, DO0, IF1, DO1, ELSE}}`. elseIfCount 0·hasElse false면 extraState 생략.
  - 블록 코멘트: `icons:{comment:{text:'...', pinned:false, height:80, width:160}}`, 읽기는 `block.getCommentText()`.
  - 한국어 메시지 중 바꿀 것: `CONTROLS_IF_MSG_THEN`="하기", `CONTROLS_IF_MSG_ELSE`="아니라면", `CONTROLS_IF_MSG_ELSEIF`="다른 경우", `VARIABLES_SET`="%1를 %2로 설정", `LOGIC_NEGATE_TITLE`="%1가 아님", `CONTROLS_WHILEUNTIL_OPERATOR_WHILE`="동안 반복", `..._UNTIL`="다음까지 반복", `PROCEDURES_DEFNORETURN_TITLE`="함수", `PROCEDURES_DEFNORETURN_PROCEDURE`="함수 이름", `PROCEDURES_DEFRETURN_RETURN`="다음을 반환함".
- `blockly/python`의 `Order` 값: ATOMIC 0, MEMBER 2.1, FUNCTION_CALL 2.2, MULTIPLICATIVE 5, ADDITIVE 6, RELATIONAL 11, LOGICAL_NOT 12, LOGICAL_AND 13, LOGICAL_OR 14, NONE 99. `valueToCode(block, name, outer)`는 `outer <= inner`이면 괄호를 친다(같은 값이면 ORDER_OVERRIDES에 없는 한 괄호). 왼쪽 피연산자에 `order + 0.1`을 넘기면 같은 우선순위에서 괄호가 안 생기고 낮은 우선순위(큰 수)에는 생긴다.
- `@lezer/python` 노드 이름(확인함): `Script`, `ImportStatement`(자식 `from`, `import`, `VariableName`, `,`), `AssignStatement`(`VariableName AssignOp 식`), `ExpressionStatement`, `CallExpression`(`VariableName|MemberExpression` + `ArgList`), `MemberExpression`(`VariableName . PropertyName`), `ArgList`(괄호·쉼표 토큰 포함), `WhileStatement`(`while 조건 Body`), `ForStatement`(`for VariableName in 식 Body`), `IfStatement`(`if 조건 Body [elif 조건 Body]* [else Body]?`), `FunctionDefinition`(`def VariableName ParamList Body`), `ParamList`, `Body`(`:` 뒤 문장들), `ReturnStatement`, `PassStatement`, `BinaryExpression`(자식 `ArithOp|CompareOp|and|or` 토큰 — `*`는 `ArithOp` 안에 중첩 토큰으로 나오므로 연산자 텍스트는 `ArithOp` 노드 텍스트로 읽는다), `UnaryExpression`(`not 식`), `ParenthesizedExpression`, `Number`, `String`, `Boolean`, `VariableName`, `PropertyName`, `Comment`(문장 노드 바깥 형제로 나타남), 문법 오류 노드는 `node.type.isError`.
- 엔트리 색상표(entryjs `EntryStatic.colorSet.block`): START `#00b400`/`#3bce3b`/`#009400`, FLOW `#19baea`/`#6dddfe`/`#1498c0`, JUDGE `#4562f5`/`#99adff`/`#1b3ad8`, CALC `#f4af18`/`#ffde82`/`#ff7f00`, VARIABLE `#dd47d8`/`#f778f3`/`#b819b3`, FUNC `#de5c04`/`#ff7b22`/`#a14100`, HARDWARE `#00b6b1`/`#78d5d3`/`#008380`, HIDDEN `#8aa3b2`/`#ffaeae`/`#728997` (순서: 기본/밝게/어둡게).

---

## 파일 구조 (이 계획에서 만드는 것)

```
esp32-blocklab/
  index.html                         Pretendard 글꼴, 한국어 lang, 루트 div
  vite.config.ts                     react + tailwind 플러그인, '@' 별칭, Pages base
  vitest.config.ts                   node 환경, src/**/*.test.ts
  playwright.config.ts               dev 서버 띄우고 e2e/ 실행
  tsconfig.json / tsconfig.app.json  '@/*' 경로 별칭 (baseUrl 없이)
  .github/workflows/deploy.yml       main 푸시 → 빌드 → Pages 배포
  src/main.tsx                       React 루트
  src/index.css                      tailwind + shadcn 토큰 + Pretendard
  src/app/App.tsx                    HashRouter, 상단 메뉴, 라우트(/, /lab)
  src/app/pages/HomePage.tsx         두 카드: 자유 코딩, 트랙(준비 중)
  src/app/lab/LabPage.tsx            자유 코딩 화면(3단 레이아웃)
  src/app/lab/editorSync.ts          블록/코드 동기화 순수 리듀서
  src/components/editor/BlocklyWorkspace.tsx  Blockly 주입 React 컴포넌트
  src/components/editor/CodePanel.tsx          CodeMirror 6 패널
  src/blocks/colors.ts               엔트리 색상표
  src/blocks/theme.ts                Blockly 테마(블록 스타일·카테고리 스타일)
  src/blocks/messages.ts             한국어 로케일 + 엔트리 문구 덮어쓰기
  src/blocks/definitions/start.ts    start_program
  src/blocks/definitions/flow.ts     flow_repeat_forever, flow_repeat_n, flow_wait, flow_wait_ms, flow_wait_us
  src/blocks/definitions/calc.ts     calc_arith, calc_concat, calc_str, calc_int
  src/blocks/definitions/esp32.ts    esp_* 하드웨어 블록
  src/blocks/definitions/code.ts     code_stmt, code_expr
  src/blocks/toolbox.ts              카테고리 툴박스
  src/blocks/index.ts                registerBlocks(), BLOCK_TYPES, CUSTOM_BLOCK_TYPES
  src/codegen/generator.ts           MicroPythonGenerator 클래스(init/finish/scrub_ 덮어쓰기)
  src/codegen/imports.ts             collectImports(text)
  src/codegen/forBlock.ts            블록별 생성기 등록
  src/codegen/index.ts               generateCode(ws), workspaceJsonToCode(json), createGenerator()
  src/parser/types.ts                BlockJson, WorkspaceJson, ParseResult
  src/parser/builders.ts             num/str/varGet/varSet/chain 등 JSON 빌더
  src/parser/context.ts              ParseContext(변수 등록, 핀·PWM·함수 표, 접기 상태)
  src/parser/tree.ts                 lezer 노드 탐색 도우미(children, text, lineOf)
  src/parser/normalize.ts            normalizeCode(code): string[]
  src/parser/patterns.ts             표준 get_distance/show 본문, 설정 패턴 인식
  src/parser/expressions.ts          식 → 값 블록
  src/parser/statements.ts           문장 → 명령 블록 체인
  src/parser/index.ts                codeToBlocks(code): ParseResult
  content/chapters/01-led/*.py       수업 저장소 챕터 1 코드 7개
  content/chapters/10-auto-door/*.py 수업 저장소 챕터 10 코드 7개
  e2e/lab.spec.ts                    Playwright 스모크
```

---

### Task 1: 프로젝트 뼈대, shadcn, 배포 파이프라인

**Files:**
- Create: `package.json`(create-vite가 생성 후 수정), `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src/app/App.tsx`, `src/app/pages/HomePage.tsx`, `src/app/lab/LabPage.tsx`(자리만), `src/lib/utils.test.ts`, `.github/workflows/deploy.yml`, `.gitignore`, `README.md`
- shadcn이 생성: `components.json`, `src/lib/utils.ts`, `src/components/ui/{button,card,badge,tabs,tooltip,resizable,sonner,switch,separator}.tsx`

**Interfaces:**
- Produces: `@/components/ui/*` 컴포넌트, `cn()` 유틸, 라우트 `#/`와 `#/lab`, 스크립트 `npm run dev|build|test|test:e2e|typecheck`.

- [ ] **Step 1: Vite React TS 프로젝트를 현재 폴더에 생성**

```bash
cd /Users/lucas/works/python_projects/esp32-blocklab
npm create vite@latest . -- --template react-ts
```
`.`에 생성할 때 "Current directory is not empty" 프롬프트가 나오면 `Ignore files and continue`를 고른다(비대화형이 필요하면 임시 폴더에 만든 뒤 `docs/`와 `.git/`을 남기고 내용을 복사한다). 생성 후 `src/App.css`, `src/assets/`, `public/vite.svg`, `src/App.tsx`를 삭제한다.

- [ ] **Step 2: 의존성 설치**

```bash
npm i
npm i tailwindcss @tailwindcss/vite blockly@^13.3 @lezer/python @lezer/common codemirror @codemirror/lang-python @codemirror/state @codemirror/view @codemirror/language react-router@^7 lucide-react
npm i -D vitest @playwright/test
npx playwright install chromium
```

- [ ] **Step 3: tsconfig 경로 별칭 (baseUrl 없이)**

`tsconfig.app.json`의 `compilerOptions`에 추가(TypeScript 6은 `baseUrl`을 경고하므로 넣지 않는다):
```json
"paths": { "@/*": ["./src/*"] }
```
`tsconfig.json`(루트, references만 있는 파일)에도 shadcn CLI가 읽을 수 있게 같은 `compilerOptions.paths`를 넣는다.

- [ ] **Step 4: vite.config.ts**

```ts
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages는 /esp32-blocklab/ 아래에 배포되므로 production 빌드만 base를 바꾼다.
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/esp32-blocklab/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { chunkSizeWarningLimit: 3000 },
}));
```

- [ ] **Step 5: vitest.config.ts**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"], exclude: ["e2e/**", "node_modules/**"] },
});
```

- [ ] **Step 6: Tailwind 진입 CSS와 shadcn 초기화**

`src/index.css`를 한 줄로 만든다: `@import "tailwindcss";`
그 다음:
```bash
npx -y shadcn@latest init -b radix -p nova -y --no-rtl --pointer -s < /dev/null
npx -y shadcn@latest add -y -s button card badge tabs tooltip resizable sonner switch separator < /dev/null
```
`src/index.css`에서 `@import "@fontsource-variable/geist";` 줄을 지우고, 파일 끝에 추가:
```css
@layer base {
  html { font-family: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif; }
  body { @apply bg-background text-foreground; }
}
```
`index.html`의 `<html lang="en">`을 `lang="ko"`로, `<title>`을 `ESP32 블록랩`으로 바꾸고 `<head>`에 글꼴을 넣는다:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
```

- [ ] **Step 7: 첫 테스트 작성 (cn 유틸)**

`src/lib/utils.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("클래스를 합치고 tailwind 충돌을 뒤쪽 값으로 정리한다", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
```
`package.json` scripts를 다음으로 맞춘다:
```json
"dev": "vite",
"build": "tsc -b && vite build",
"preview": "vite preview",
"typecheck": "tsc -b --noEmit",
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 8: 테스트 실행 → 통과 확인**

Run: `npm test`
Expected: `1 passed`

- [ ] **Step 9: 앱 뼈대 작성**

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/app/App.tsx`:
```tsx
import { HashRouter, Link, NavLink, Route, Routes } from "react-router";
import { Blocks, Cpu, Route as RouteIcon, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { HomePage } from "./pages/HomePage";
import { LabPage } from "./lab/LabPage";

const navItems = [
  { to: "/lab", label: "자유 코딩", icon: Blocks },
  { to: "/track", label: "트랙", icon: RouteIcon, soon: true },
  { to: "/settings", label: "설정", icon: Settings, soon: true },
];

export function App() {
  return (
    <HashRouter>
      <div className="flex h-screen flex-col">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Cpu className="size-5" />
            ESP32 블록랩
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {navItems.map(({ to, label, icon: Icon, soon }) => (
              <NavLink
                key={to}
                to={soon ? "#" : to}
                aria-disabled={soon}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                    isActive && !soon && "bg-muted text-foreground",
                    soon && "pointer-events-none opacity-60",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
                {soon && <Badge variant="outline">준비 중</Badge>}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lab" element={<LabPage />} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </HashRouter>
  );
}
```

`src/app/pages/HomePage.tsx`:
```tsx
import { Link } from "react-router";
import { ArrowRight, Blocks, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">블록으로 만들고, 코드로 읽는 ESP32</h1>
      <p className="mt-2 text-muted-foreground">
        블록을 놓으면 MicroPython 코드가 바로 바뀌고, 코드를 고치면 블록이 따라옵니다.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Blocks className="size-5" />자유 코딩</CardTitle>
            <CardDescription>블록과 코드를 나란히 놓고 바로 써 봅니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link to="/lab">열기 <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>
        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RouteIcon className="size-5" />트랙</CardTitle>
            <CardDescription>챕터별 미션을 순서대로 풀며 넘어갑니다. 준비 중입니다.</CardDescription>
          </CardHeader>
          <CardContent><Button disabled>준비 중</Button></CardContent>
        </Card>
      </div>
    </div>
  );
}
```

`src/app/lab/LabPage.tsx` (Task 5에서 교체되는 자리표시):
```tsx
export function LabPage() {
  return <div className="p-8 text-muted-foreground">자유 코딩 화면은 Task 5에서 만들어집니다.</div>;
}
```

- [ ] **Step 10: 빌드·타입 확인**

Run: `npm run build`
Expected: `dist/` 생성, 오류 없음. 경고 중 Blockly 청크 크기 경고는 무시.

- [ ] **Step 11: 배포 워크플로와 README**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: cp dist/index.html dist/404.html
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`README.md`: 프로젝트 한 줄 소개, 실행 방법(`npm i`, `npm run dev`, Chrome 필요), 폴더 구조 요약(위 파일 구조에서 발췌), 설계 문서 링크. `.gitignore`에 `dist`, `node_modules`, `test-results`, `playwright-report`가 있는지 확인한다.

- [ ] **Step 12: 커밋, GitHub 저장소 생성, Pages 설정**

```bash
git add -A
git commit -m "프로젝트 뼈대: Vite + React + shadcn/ui + Pages 배포

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
gh repo create SangWon7242/esp32-blocklab --public --source=. --remote=origin --push \
  --description "ESP32 블록랩 - 블록과 MicroPython을 양방향으로 오가는 교육용 웹"
gh api -X POST repos/SangWon7242/esp32-blocklab/pages -f build_type=workflow
```
마지막 명령이 409(이미 설정됨)를 돌려주면 정상이다. `gh run watch`로 첫 배포가 성공하는지 확인하고 `https://sangwon7242.github.io/esp32-blocklab/`이 열리는지 본다.

---

### Task 2: 블록 어휘, 엔트리 테마, 툴박스, 한국어 문구

**Files:**
- Create: `src/blocks/colors.ts`, `src/blocks/theme.ts`, `src/blocks/messages.ts`, `src/blocks/definitions/start.ts`, `src/blocks/definitions/flow.ts`, `src/blocks/definitions/calc.ts`, `src/blocks/definitions/esp32.ts`, `src/blocks/definitions/code.ts`, `src/blocks/toolbox.ts`, `src/blocks/index.ts`
- Test: `src/blocks/blocks.test.ts`

**Interfaces:**
- Produces:
  - `registerBlocks(): void` — 멱등. 로케일 적용 + 커스텀 블록 정의. 어디서든 Blockly를 쓰기 전에 호출.
  - `CUSTOM_BLOCK_TYPES: readonly string[]` — 커스텀 블록 type 목록.
  - `BUILTIN_BLOCK_TYPES: readonly string[]` — 쓰는 내장 블록 목록(`controls_if`, `controls_whileUntil`, `logic_compare`, `logic_operation`, `logic_negate`, `logic_boolean`, `math_number`, `text`, `variables_set`, `variables_get`, `procedures_defnoreturn`, `procedures_defreturn`, `procedures_callnoreturn`, `procedures_callreturn`).
  - `entryTheme: Blockly.Theme`, `toolbox: Blockly.utils.toolbox.ToolboxDefinition`.
  - 블록 type과 필드 이름(Task 3·4가 그대로 쓴다):
    - `start_program` — statement input `BODY`
    - `flow_repeat_forever` — `DO`
    - `flow_repeat_n` — value `TIMES`, statement `DO`
    - `flow_wait` `SEC` / `flow_wait_ms` `MS` / `flow_wait_us` `US` (value inputs)
    - `calc_arith` — dropdown `OP`(ADD, MINUS, MULTIPLY, DIVIDE, FLOORDIV, MOD), values `A`, `B`
    - `calc_concat` — `A`, `B`; `calc_str` — `X`; `calc_int` — `X`
    - `esp_pin_setup` — `PIN`(number), `MODE`(OUT|IN), `VAR`(variable)
    - `esp_pin_write` — `VAR`, `VALUE`('1'|'0'); `esp_pin_read` — `VAR` (값 블록)
    - `esp_pwm_setup` — `VAR`, `PIN`, `FREQ`; `esp_servo_setup` — `VAR`, `PIN`
    - `esp_pwm_duty` — `VAR`, value `DUTY`; `esp_servo_door` — `VAR`, `ACTION`('8100'|'1638')
    - `esp_ultrasonic_setup` — `TRIG`, `ECHO`; `esp_distance` (값)
    - `esp_oled_setup` — `SCL`, `SDA`; `esp_oled_show` — values `A`, `B`
    - `esp_print` — value `VALUE`; `esp_print2` — values `A`, `B`
    - `code_stmt` — text field `CODE`; `code_expr` — text field `CODE` (값)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/blocks/blocks.test.ts`:
```ts
import { describe, expect, it, beforeAll } from "vitest";
import * as Blockly from "blockly";
import { BUILTIN_BLOCK_TYPES, CUSTOM_BLOCK_TYPES, entryTheme, registerBlocks, toolbox } from "./index";

beforeAll(() => {
  registerBlocks();
  registerBlocks(); // 두 번 불러도 오류가 없어야 한다
});

describe("블록 정의", () => {
  it("커스텀 블록이 모두 등록된다", () => {
    for (const type of CUSTOM_BLOCK_TYPES) expect(Blockly.Blocks[type], type).toBeDefined();
  });

  it("헤드리스 작업판에서 모든 블록을 만들 수 있다", () => {
    const ws = new Blockly.Workspace();
    for (const type of [...CUSTOM_BLOCK_TYPES, ...BUILTIN_BLOCK_TYPES]) {
      const block = ws.newBlock(type);
      expect(block.type).toBe(type);
    }
    ws.dispose();
  });

  it("필드 이름이 약속과 같다", () => {
    const ws = new Blockly.Workspace();
    const pin = ws.newBlock("esp_pin_setup");
    expect(pin.getField("PIN")).toBeTruthy();
    expect(pin.getField("MODE")).toBeTruthy();
    expect(pin.getField("VAR")).toBeTruthy();
    expect(pin.getFieldValue("MODE")).toBe("OUT");
    const arith = ws.newBlock("calc_arith");
    expect(arith.getInput("A")).toBeTruthy();
    expect(arith.getInput("B")).toBeTruthy();
    expect(arith.getFieldValue("OP")).toBe("ADD");
    const start = ws.newBlock("start_program");
    expect(start.getInput("BODY")).toBeTruthy();
    expect(start.previousConnection).toBeNull();
    ws.dispose();
  });

  it("한국어 문구가 엔트리 표현으로 바뀐다", () => {
    expect(Blockly.Msg.CONTROLS_IF_MSG_THEN).toBe("이라면");
    expect(Blockly.Msg.CONTROLS_IF_MSG_ELSE).toBe("아니면");
    expect(Blockly.Msg.VARIABLES_SET).toBe("%1 를 %2 로 정하기");
    expect(Blockly.Msg.CONTROLS_REPEAT_TITLE).toBe("%1회 반복"); // 로케일이 적용됐다는 표식
  });
});

describe("테마와 툴박스", () => {
  it("엔트리 색을 가진 블록 스타일이 있다", () => {
    expect(entryTheme.blockStyles.start_blocks.colourPrimary).toBe("#00b400");
    expect(entryTheme.blockStyles.loop_blocks.colourPrimary).toBe("#19baea");
    expect(entryTheme.blockStyles.logic_blocks.colourPrimary).toBe("#4562f5");
    expect(entryTheme.blockStyles.hardware_blocks.colourPrimary).toBe("#00b6b1");
    expect(entryTheme.blockStyles.code_blocks.colourPrimary).toBe("#8aa3b2");
  });

  it("카테고리 순서가 엔트리와 같다", () => {
    const names = (toolbox as { contents: { name: string }[] }).contents.map((c) => c.name);
    expect(names).toEqual(["시작", "흐름", "판단", "계산", "변수", "함수", "ESP32", "코드"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/blocks`
Expected: FAIL — `./index` 모듈 없음.

- [ ] **Step 3: 색상표와 테마**

`src/blocks/colors.ts`:
```ts
/** entryjs EntryStatic.colorSet.block 에서 가져온 엔트리 카테고리 색 (기본 / 밝게 / 어둡게) */
export const ENTRY_COLORS = {
  START: { primary: "#00b400", secondary: "#3bce3b", tertiary: "#009400" },
  FLOW: { primary: "#19baea", secondary: "#6dddfe", tertiary: "#1498c0" },
  JUDGE: { primary: "#4562f5", secondary: "#99adff", tertiary: "#1b3ad8" },
  CALC: { primary: "#f4af18", secondary: "#ffde82", tertiary: "#ff7f00" },
  VARIABLE: { primary: "#dd47d8", secondary: "#f778f3", tertiary: "#b819b3" },
  FUNC: { primary: "#de5c04", secondary: "#ff7b22", tertiary: "#a14100" },
  HARDWARE: { primary: "#00b6b1", secondary: "#78d5d3", tertiary: "#008380" },
  CODE: { primary: "#8aa3b2", secondary: "#b8c7d1", tertiary: "#728997" },
} as const;
```

`src/blocks/theme.ts`:
```ts
import * as Blockly from "blockly";
import { ENTRY_COLORS } from "./colors";

const style = (c: { primary: string; secondary: string; tertiary: string }) => ({
  colourPrimary: c.primary,
  colourSecondary: c.secondary,
  colourTertiary: c.tertiary,
});

export const entryTheme = Blockly.Theme.defineTheme("entry", {
  name: "entry",
  base: Blockly.Themes.Zelos,
  blockStyles: {
    start_blocks: style(ENTRY_COLORS.START),
    loop_blocks: style(ENTRY_COLORS.FLOW),
    logic_blocks: style(ENTRY_COLORS.JUDGE),
    math_blocks: style(ENTRY_COLORS.CALC),
    text_blocks: style(ENTRY_COLORS.CALC),
    variable_blocks: style(ENTRY_COLORS.VARIABLE),
    variable_dynamic_blocks: style(ENTRY_COLORS.VARIABLE),
    procedure_blocks: style(ENTRY_COLORS.FUNC),
    hardware_blocks: style(ENTRY_COLORS.HARDWARE),
    code_blocks: style(ENTRY_COLORS.CODE),
  },
  categoryStyles: {
    start_category: { colour: ENTRY_COLORS.START.primary },
    flow_category: { colour: ENTRY_COLORS.FLOW.primary },
    judge_category: { colour: ENTRY_COLORS.JUDGE.primary },
    calc_category: { colour: ENTRY_COLORS.CALC.primary },
    variable_category: { colour: ENTRY_COLORS.VARIABLE.primary },
    func_category: { colour: ENTRY_COLORS.FUNC.primary },
    hardware_category: { colour: ENTRY_COLORS.HARDWARE.primary },
    code_category: { colour: ENTRY_COLORS.CODE.primary },
  },
  componentStyles: {
    workspaceBackgroundColour: "#f6f7f9",
    toolboxBackgroundColour: "#ffffff",
    toolboxForegroundColour: "#1f2937",
    flyoutBackgroundColour: "#f8f9fb",
    flyoutOpacity: 1,
    scrollbarColour: "#cbd5e1",
    insertionMarkerColour: "#1f2937",
    insertionMarkerOpacity: 0.3,
  },
  fontStyle: { family: '"Pretendard Variable", Pretendard, sans-serif', weight: "500", size: 12 },
});
```

- [ ] **Step 4: 한국어 로케일과 문구 덮어쓰기**

`src/blocks/messages.ts`:
```ts
import * as Blockly from "blockly";
import * as Ko from "blockly/msg/ko";

/** 내장 블록의 한국어 문구를 엔트리 표현에 맞춘다. registerBlocks() 안에서 한 번 호출. */
export function applyKoreanMessages(): void {
  Blockly.setLocale(Ko as unknown as Record<string, string>);
  Object.assign(Blockly.Msg, {
    CONTROLS_IF_MSG_IF: "만약",
    CONTROLS_IF_MSG_THEN: "이라면",
    CONTROLS_IF_MSG_ELSE: "아니면",
    CONTROLS_IF_MSG_ELSEIF: "아니면 만약",
    CONTROLS_WHILEUNTIL_OPERATOR_WHILE: "인 동안 반복하기",
    CONTROLS_WHILEUNTIL_OPERATOR_UNTIL: "이 될 때까지 반복하기",
    LOGIC_NEGATE_TITLE: "%1 이(가) 아니다",
    LOGIC_BOOLEAN_TRUE: "참",
    LOGIC_BOOLEAN_FALSE: "거짓",
    VARIABLES_SET: "%1 를 %2 로 정하기",
    VARIABLES_GET: "%1 값",
    PROCEDURES_DEFNORETURN_TITLE: "함수 정의하기",
    PROCEDURES_DEFNORETURN_PROCEDURE: "이름",
    PROCEDURES_DEFRETURN_TITLE: "함수 정의하기",
    PROCEDURES_DEFRETURN_PROCEDURE: "이름",
    PROCEDURES_DEFRETURN_RETURN: "돌려주기",
    PROCEDURES_BEFORE_PARAMS: "매개변수:",
    PROCEDURES_CALL_BEFORE_PARAMS: "값:",
    PROCEDURES_CALLNORETURN_TOOLTIP: "정의한 함수를 실행합니다.",
    PROCEDURES_CALLRETURN_TOOLTIP: "정의한 함수를 실행하고 결과값을 돌려줍니다.",
    NEW_VARIABLE: "변수 만들기",
    TEXT_TEXT_TOOLTIP: "글자",
  });
}
```

- [ ] **Step 5: 블록 정의 (시작·흐름·계산·코드)**

`src/blocks/definitions/start.ts`:
```ts
export const startBlocks = [
  {
    type: "start_program",
    message0: "프로그램이 시작되면",
    message1: "%1",
    args1: [{ type: "input_statement", name: "BODY" }],
    style: "start_blocks",
    hat: "cap",
    tooltip: "보드가 켜지면 이 안의 블록을 위에서부터 차례로 실행합니다.",
  },
];
```

`src/blocks/definitions/flow.ts`:
```ts
export const flowBlocks = [
  {
    type: "flow_repeat_forever",
    message0: "계속 반복하기",
    message1: "%1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    style: "loop_blocks",
    tooltip: "while True: 안의 블록을 끝없이 반복합니다.",
  },
  {
    type: "flow_repeat_n",
    message0: "%1 번 반복하기",
    args0: [{ type: "input_value", name: "TIMES", check: "Number" }],
    message1: "%1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    style: "loop_blocks",
    tooltip: "for i in range(n): 으로 정한 횟수만큼 반복합니다.",
  },
  {
    type: "flow_wait",
    message0: "%1 초 기다리기",
    args0: [{ type: "input_value", name: "SEC", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "loop_blocks",
    tooltip: "time.sleep(초)",
  },
  {
    type: "flow_wait_ms",
    message0: "%1 밀리초 기다리기",
    args0: [{ type: "input_value", name: "MS", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "loop_blocks",
    tooltip: "time.sleep_ms(밀리초). 1초 = 1000밀리초",
  },
  {
    type: "flow_wait_us",
    message0: "%1 마이크로초 기다리기",
    args0: [{ type: "input_value", name: "US", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "loop_blocks",
    tooltip: "time.sleep_us(마이크로초). 1초 = 1,000,000마이크로초",
  },
];
```

`src/blocks/definitions/calc.ts`:
```ts
export const calcBlocks = [
  {
    type: "calc_arith",
    message0: "%1 %2 %3",
    args0: [
      { type: "input_value", name: "A" },
      {
        type: "field_dropdown",
        name: "OP",
        options: [["+", "ADD"], ["-", "MINUS"], ["×", "MULTIPLY"], ["÷", "DIVIDE"], ["//", "FLOORDIV"], ["%", "MOD"]],
      },
      { type: "input_value", name: "B" },
    ],
    inputsInline: true,
    output: "Number",
    style: "math_blocks",
    tooltip: "// 는 나눈 몫(정수), % 는 나머지입니다.",
  },
  {
    type: "calc_concat",
    message0: "%1 와(과) %2 합치기",
    args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
    inputsInline: true,
    output: "String",
    style: "text_blocks",
    tooltip: "두 글자를 이어 붙입니다. 숫자는 먼저 글자로 바꿔야 합니다.",
  },
  {
    type: "calc_str",
    message0: "%1 을(를) 글자로",
    args0: [{ type: "input_value", name: "X" }],
    output: "String",
    style: "text_blocks",
    tooltip: "str(값). 화면에는 글자만 들어갑니다.",
  },
  {
    type: "calc_int",
    message0: "%1 을(를) 정수로",
    args0: [{ type: "input_value", name: "X" }],
    output: "Number",
    style: "math_blocks",
    tooltip: "int(값). 소수점을 버립니다.",
  },
];
```

`src/blocks/definitions/code.ts`:
```ts
export const codeBlocks = [
  {
    type: "code_stmt",
    message0: "코드 %1",
    args0: [{ type: "field_input", name: "CODE", text: "pass" }],
    previousStatement: null,
    nextStatement: null,
    style: "code_blocks",
    tooltip: "블록으로 바꾸지 못한 코드 한 줄을 그대로 둡니다.",
  },
  {
    type: "code_expr",
    message0: "식 %1",
    args0: [{ type: "field_input", name: "CODE", text: "0" }],
    output: null,
    style: "code_blocks",
    tooltip: "블록으로 바꾸지 못한 식을 그대로 둡니다.",
  },
];
```

- [ ] **Step 6: ESP32 블록 정의**

`src/blocks/definitions/esp32.ts`:
```ts
const pin = (name: string, value: number) => ({ type: "field_number", name, value, min: 0, max: 39, precision: 1 });
const stmt = { previousStatement: null, nextStatement: null, style: "hardware_blocks" };

export const esp32Blocks = [
  {
    type: "esp_pin_setup",
    message0: "핀 %1 을(를) %2 으로 준비하고 %3 이름 붙이기",
    args0: [
      pin("PIN", 26),
      { type: "field_dropdown", name: "MODE", options: [["출력", "OUT"], ["입력", "IN"]] },
      { type: "field_variable", name: "VAR", variable: "led" },
    ],
    ...stmt,
    tooltip: "led = Pin(26, Pin.OUT) 처럼 핀에 이름을 붙입니다. 코드 맨 위에 모입니다.",
  },
  {
    type: "esp_pin_write",
    message0: "%1 %2",
    args0: [
      { type: "field_variable", name: "VAR", variable: "led" },
      { type: "field_dropdown", name: "VALUE", options: [["켜기", "1"], ["끄기", "0"]] },
    ],
    ...stmt,
    tooltip: "led.value(1) 은 켜기, led.value(0) 은 끄기",
  },
  {
    type: "esp_pin_read",
    message0: "%1 값",
    args0: [{ type: "field_variable", name: "VAR", variable: "echo" }],
    output: "Number",
    style: "hardware_blocks",
    tooltip: "echo.value() — 입력 핀의 값(0 또는 1)",
  },
  {
    type: "esp_pwm_setup",
    message0: "PWM %1 을(를) 핀 %2 에 준비하기 (주파수 %3 Hz)",
    args0: [{ type: "field_variable", name: "VAR", variable: "pwm" }, pin("PIN", 2), { type: "field_number", name: "FREQ", value: 1000, min: 1, precision: 1 }],
    ...stmt,
    tooltip: "pwm = PWM(Pin(2)); pwm.freq(1000)",
  },
  {
    type: "esp_servo_setup",
    message0: "서보 %1 을(를) 핀 %2 에 준비하기 (처음엔 닫기)",
    args0: [{ type: "field_variable", name: "VAR", variable: "servo" }, pin("PIN", 4)],
    ...stmt,
    tooltip: "servo = PWM(Pin(4)); servo.freq(50); servo.duty_u16(1638)",
  },
  {
    type: "esp_pwm_duty",
    message0: "%1 세기를 %2 로 정하기",
    args0: [{ type: "field_variable", name: "VAR", variable: "pwm" }, { type: "input_value", name: "DUTY", check: "Number" }],
    ...stmt,
    tooltip: "pwm.duty_u16(0~65535)",
  },
  {
    type: "esp_servo_door",
    message0: "%1 문 %2",
    args0: [
      { type: "field_variable", name: "VAR", variable: "servo" },
      { type: "field_dropdown", name: "ACTION", options: [["열기", "8100"], ["닫기", "1638"]] },
    ],
    ...stmt,
    tooltip: "열기 = duty_u16(8100), 닫기 = duty_u16(1638)",
  },
  {
    type: "esp_ultrasonic_setup",
    message0: "초음파 센서 준비하기 (trig 핀 %1, echo 핀 %2)",
    args0: [pin("TRIG", 13), pin("ECHO", 12)],
    ...stmt,
    tooltip: "trig/echo 핀을 만들고 거리를 재는 get_distance() 함수를 준비합니다.",
  },
  {
    type: "esp_distance",
    message0: "거리 (cm)",
    output: "Number",
    style: "hardware_blocks",
    tooltip: "get_distance() — 초음파로 잰 거리(cm)",
  },
  {
    type: "esp_oled_setup",
    message0: "OLED 화면 준비하기 (scl 핀 %1, sda 핀 %2)",
    args0: [pin("SCL", 22), pin("SDA", 21)],
    ...stmt,
    tooltip: "i2c 와 oled 를 만들고 두 줄을 띄우는 show(a, b) 함수를 준비합니다.",
  },
  {
    type: "esp_oled_show",
    message0: "화면에 %1 와(과) %2 보여주기",
    args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
    inputsInline: true,
    ...stmt,
    tooltip: "show(첫째 줄, 둘째 줄)",
  },
  {
    type: "esp_print",
    message0: "%1 출력하기",
    args0: [{ type: "input_value", name: "VALUE" }],
    ...stmt,
    tooltip: "print(값) — 시리얼 모니터에 찍습니다.",
  },
  {
    type: "esp_print2",
    message0: "%1 와(과) %2 출력하기",
    args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
    inputsInline: true,
    ...stmt,
    tooltip: "print(a, b) — 두 값을 띄어서 찍습니다.",
  },
];
```

- [ ] **Step 7: 툴박스와 등록 함수**

`src/blocks/toolbox.ts`:
```ts
import type * as Blockly from "blockly";

const block = (type: string, extra: Record<string, unknown> = {}) => ({ kind: "block", type, ...extra });
const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

export const toolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: "categoryToolbox",
  contents: [
    { kind: "category", name: "시작", categorystyle: "start_category", contents: [block("start_program")] },
    {
      kind: "category",
      name: "흐름",
      categorystyle: "flow_category",
      contents: [
        block("flow_repeat_forever"),
        block("flow_repeat_n", { inputs: { TIMES: num(3) } }),
        block("controls_whileUntil"),
        block("controls_if"),
        block("controls_if", { extraState: { hasElse: true } }),
        block("flow_wait", { inputs: { SEC: num(1) } }),
        block("flow_wait_ms", { inputs: { MS: num(500) } }),
        block("flow_wait_us", { inputs: { US: num(10) } }),
      ],
    },
    {
      kind: "category",
      name: "판단",
      categorystyle: "judge_category",
      contents: [
        block("logic_compare", { inputs: { A: num(0), B: num(15) } }),
        block("logic_operation"),
        block("logic_negate"),
        block("logic_boolean"),
      ],
    },
    {
      kind: "category",
      name: "계산",
      categorystyle: "calc_category",
      contents: [
        block("math_number", { fields: { NUM: 0 } }),
        block("text", { fields: { TEXT: "안녕" } }),
        block("calc_arith", { inputs: { A: num(1), B: num(1) } }),
        block("calc_concat", { inputs: { A: { shadow: { type: "text", fields: { TEXT: "" } } }, B: { shadow: { type: "text", fields: { TEXT: " cm" } } } } }),
        block("calc_str"),
        block("calc_int"),
      ],
    },
    { kind: "category", name: "변수", categorystyle: "variable_category", custom: "VARIABLE" },
    { kind: "category", name: "함수", categorystyle: "func_category", custom: "PROCEDURE" },
    {
      kind: "category",
      name: "ESP32",
      categorystyle: "hardware_category",
      contents: [
        { kind: "label", text: "핀" },
        block("esp_pin_setup"),
        block("esp_pin_write"),
        block("esp_pin_read"),
        block("esp_print"),
        block("esp_print2"),
        { kind: "label", text: "모터" },
        block("esp_servo_setup"),
        block("esp_servo_door"),
        block("esp_pwm_setup"),
        block("esp_pwm_duty", { inputs: { DUTY: num(32768) } }),
        { kind: "label", text: "센서와 화면" },
        block("esp_ultrasonic_setup"),
        block("esp_distance"),
        block("esp_oled_setup"),
        block("esp_oled_show", { inputs: { A: { shadow: { type: "text", fields: { TEXT: "AUTO DOOR" } } }, B: { shadow: { type: "text", fields: { TEXT: "Come closer" } } } } }),
      ],
    },
    { kind: "category", name: "코드", categorystyle: "code_category", contents: [block("code_stmt"), block("code_expr")] },
  ],
};
```

`src/blocks/index.ts`:
```ts
import * as Blockly from "blockly";
import { applyKoreanMessages } from "./messages";
import { startBlocks } from "./definitions/start";
import { flowBlocks } from "./definitions/flow";
import { calcBlocks } from "./definitions/calc";
import { esp32Blocks } from "./definitions/esp32";
import { codeBlocks } from "./definitions/code";

export { entryTheme } from "./theme";
export { toolbox } from "./toolbox";

const definitions = [...startBlocks, ...flowBlocks, ...calcBlocks, ...esp32Blocks, ...codeBlocks];

export const CUSTOM_BLOCK_TYPES: readonly string[] = definitions.map((d) => d.type);

export const BUILTIN_BLOCK_TYPES: readonly string[] = [
  "controls_if", "controls_whileUntil", "logic_compare", "logic_operation", "logic_negate", "logic_boolean",
  "math_number", "text", "variables_set", "variables_get",
  "procedures_defnoreturn", "procedures_defreturn", "procedures_callnoreturn", "procedures_callreturn",
];

let registered = false;

/** 로케일을 적용하고 커스텀 블록을 정의한다. 여러 번 불러도 안전하다. */
export function registerBlocks(): void {
  if (registered) return;
  applyKoreanMessages();
  Blockly.defineBlocksWithJsonArray(definitions);
  registered = true;
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test -- src/blocks`
Expected: PASS (6 tests). `field_variable`가 헤드리스에서 변수를 자동 생성하지 못해 `newBlock`이 실패하면, 테스트의 `ws.newBlock` 전에 `ws.getVariableMap().createVariable("led", "", "var_led")`를 넣는 대신 블록 정의의 `variable` 기본값이 동작하는지 먼저 확인한다(Blockly 13은 기본값으로 변수를 만든다).

- [ ] **Step 9: 빌드 확인 후 커밋**

Run: `npm run build`
```bash
git add src/blocks
git commit -m "블록 어휘와 엔트리 테마: 시작·흐름·계산·ESP32·코드 블록, 한국어 문구

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 블록 → MicroPython 생성기

**Files:**
- Create: `src/codegen/generator.ts`, `src/codegen/imports.ts`, `src/codegen/forBlock.ts`, `src/codegen/index.ts`
- Test: `src/codegen/imports.test.ts`, `src/codegen/codegen.test.ts`

**Interfaces:**
- Consumes: Task 2의 `registerBlocks()`, 블록 type·필드 이름.
- Produces:
  - `createGenerator(): MicroPythonGenerator` — 싱글턴 아님(테스트 격리용). 보통은 `generateCode` 사용.
  - `generateCode(ws: Blockly.Workspace): string` — 작업판 전체 코드.
  - `workspaceJsonToCode(json: WorkspaceJson): string` — 헤드리스 작업판에 JSON을 올려 코드 생성(테스트·동기화용).
  - `collectImports(text: string): string[]` — 본문을 보고 필요한 import 줄 목록.
  - `type WorkspaceJson = ReturnType<typeof Blockly.serialization.workspaces.save>` (`src/codegen/index.ts`에서 export; Task 4의 `parser/types.ts`가 재export).

- [ ] **Step 1: import 수집 테스트**

`src/codegen/imports.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { collectImports } from "./imports";

describe("collectImports", () => {
  it("쓰인 것만, 정해진 순서로 낸다", () => {
    expect(collectImports("led = Pin(26, Pin.OUT)\nled.value(1)\n")).toEqual(["from machine import Pin"]);
    expect(collectImports("led = Pin(26, Pin.OUT)\ntime.sleep(1)\n")).toEqual(["from machine import Pin", "import time"]);
    expect(
      collectImports("servo = PWM(Pin(4))\ni2c = SoftI2C(scl=Pin(22), sda=Pin(21))\noled = ssd1306.SSD1306_I2C(128, 64, i2c)\ntime.sleep(2)\n"),
    ).toEqual(["from machine import Pin, PWM, SoftI2C", "import ssd1306", "import time"]);
  });
  it("아무것도 안 쓰면 빈 배열", () => {
    expect(collectImports("print(1)\n")).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/codegen/imports`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: imports.ts 구현**

`src/codegen/imports.ts`:
```ts
/** 생성된 본문을 보고 필요한 import 줄을 수업 저장소 순서(machine → ssd1306 → time)로 만든다. */
export function collectImports(text: string): string[] {
  const lines: string[] = [];
  const machine = ["Pin", "PWM", "SoftI2C"].filter((name) => new RegExp(`\\b${name}\\(`).test(text));
  if (machine.length) lines.push(`from machine import ${machine.join(", ")}`);
  if (/\bssd1306\./.test(text)) lines.push("import ssd1306");
  if (/\btime\./.test(text)) lines.push("import time");
  return lines;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/codegen/imports`
Expected: PASS

- [ ] **Step 5: 생성기 테스트 작성 (기대 코드는 수업 저장소 파일에서 주석을 뗀 것)**

`src/codegen/codegen.test.ts`:
```ts
import { describe, expect, it, beforeAll } from "vitest";
import { registerBlocks } from "@/blocks";
import { workspaceJsonToCode, type WorkspaceJson } from "./index";

beforeAll(() => registerBlocks());

type B = Record<string, unknown>;
const num = (n: number): B => ({ type: "math_number", fields: { NUM: n } });
const str = (s: string): B => ({ type: "text", fields: { TEXT: s } });
const varGet = (name: string): B => ({ type: "variables_get", fields: { VAR: { id: `var_${name}` } } });
/** 명령 블록 배열을 next 체인으로 잇는다 */
function chain(blocks: B[]): B {
  const [head, ...rest] = blocks.map((b) => ({ ...b }));
  let cur = head;
  for (const b of rest) { cur.next = { block: b }; cur = b; }
  return head;
}
function program(body: B[], extra: { tops?: B[]; vars?: string[] } = {}): WorkspaceJson {
  return {
    variables: (extra.vars ?? []).map((name) => ({ name, id: `var_${name}` })),
    blocks: { languageVersion: 0, blocks: [...(extra.tops ?? []), { type: "start_program", x: 0, y: 0, inputs: { BODY: { block: chain(body) } } }] },
  } as WorkspaceJson;
}
const pinSetup = (name: string, pin: number, mode = "OUT"): B => ({ type: "esp_pin_setup", fields: { PIN: pin, MODE: mode, VAR: { id: `var_${name}` } } });
const pinWrite = (name: string, v: 0 | 1): B => ({ type: "esp_pin_write", fields: { VAR: { id: `var_${name}` }, VALUE: String(v) } });
const wait = (sec: number): B => ({ type: "flow_wait", inputs: { SEC: { block: num(sec) } } });
const waitMs = (ms: number): B => ({ type: "flow_wait_ms", inputs: { MS: { block: num(ms) } } });
const forever = (body: B[]): B => ({ type: "flow_repeat_forever", inputs: { DO: { block: chain(body) } } });

describe("챕터 1 코드 모양", () => {
  it("step1_led_on", () => {
    const code = workspaceJsonToCode(program([pinSetup("led", 26), pinWrite("led", 1)], { vars: ["led"] }));
    expect(code).toBe("from machine import Pin\n\nled = Pin(26, Pin.OUT)\n\nled.value(1)\n");
  });

  it("step4_blink_loop", () => {
    const code = workspaceJsonToCode(
      program([pinSetup("led", 26), forever([pinWrite("led", 1), wait(1), pinWrite("led", 0), wait(1)])], { vars: ["led"] }),
    );
    expect(code).toBe(
      "from machine import Pin\nimport time\n\nled = Pin(26, Pin.OUT)\n\nwhile True:\n    led.value(1)\n    time.sleep(1)\n    led.value(0)\n    time.sleep(1)\n",
    );
  });

  it("mission3_sos: 함수 정의·매개변수·n번 반복", () => {
    const def: B = {
      type: "procedures_defnoreturn",
      x: 0, y: 0,
      extraState: { params: [{ name: "t", id: "var_t" }] },
      fields: { NAME: "blink" },
      inputs: { STACK: { block: chain([pinWrite("led", 1), { type: "flow_wait", inputs: { SEC: { block: varGet("t") } } }, pinWrite("led", 0), wait(0.2)]) } },
    };
    const call = (t: number): B => ({ type: "procedures_callnoreturn", extraState: { name: "blink", params: ["t"] }, inputs: { ARG0: { block: num(t) } } });
    const repeat3 = (t: number): B => ({ type: "flow_repeat_n", inputs: { TIMES: { block: num(3) }, DO: { block: call(t) } } });
    const code = workspaceJsonToCode(
      program([pinSetup("led", 26), forever([repeat3(0.2), repeat3(0.6), repeat3(0.2), wait(1)])], { tops: [def], vars: ["led", "t"] }),
    );
    expect(code).toBe(
      [
        "from machine import Pin",
        "import time",
        "",
        "led = Pin(26, Pin.OUT)",
        "",
        "",
        "def blink(t):",
        "    led.value(1)",
        "    time.sleep(t)",
        "    led.value(0)",
        "    time.sleep(0.2)",
        "",
        "",
        "while True:",
        "    for i in range(3):",
        "        blink(0.2)",
        "    for i in range(3):",
        "        blink(0.6)",
        "    for i in range(3):",
        "        blink(0.2)",
        "    time.sleep(1)",
        "",
      ].join("\n"),
    );
  });
});

describe("챕터 10 코드 모양", () => {
  it("step3_auto_door: 접힌 초음파·서보·OLED, if, 문자 합치기", () => {
    const d = "d";
    const show = (a: B, b: B): B => ({ type: "esp_oled_show", inputs: { A: { block: a }, B: { block: b } } });
    const door = (action: "8100" | "1638"): B => ({ type: "esp_servo_door", fields: { VAR: { id: "var_servo" }, ACTION: action } });
    const code = workspaceJsonToCode(
      program(
        [
          { type: "esp_ultrasonic_setup", fields: { TRIG: 13, ECHO: 12 } },
          { type: "esp_servo_setup", fields: { VAR: { id: "var_servo" }, PIN: 4 } },
          { type: "esp_oled_setup", fields: { SCL: 22, SDA: 21 } },
          wait(2),
          show(str("AUTO DOOR"), str("Come closer")),
          forever([
            { type: "variables_set", fields: { VAR: { id: `var_${d}` } }, inputs: { VALUE: { block: { type: "esp_distance" } } } },
            {
              type: "controls_if",
              inputs: {
                IF0: { block: { type: "logic_compare", fields: { OP: "LT" }, inputs: { A: { block: varGet(d) }, B: { block: num(15) } } } },
                DO0: {
                  block: chain([
                    show(str("DOOR OPEN"), { type: "calc_concat", inputs: { A: { block: { type: "calc_str", inputs: { X: { block: varGet(d) } } } }, B: { block: str(" cm") } } }),
                    door("8100"), wait(3), show(str("DOOR CLOSE"), str("Bye~")), door("1638"), wait(1), show(str("AUTO DOOR"), str("Come closer")),
                  ]),
                },
              },
            },
            waitMs(300),
          ]),
        ],
        { vars: ["servo", "d"] },
      ),
    );
    expect(code).toBe(
      [
        "from machine import Pin, PWM, SoftI2C",
        "import ssd1306",
        "import time",
        "",
        "trig = Pin(13, Pin.OUT)",
        "echo = Pin(12, Pin.IN)",
        "servo = PWM(Pin(4))",
        "servo.freq(50)",
        "servo.duty_u16(1638)",
        "i2c = SoftI2C(scl=Pin(22), sda=Pin(21))",
        "oled = ssd1306.SSD1306_I2C(128, 64, i2c)",
        "",
        "",
        "def get_distance():",
        "    trig.value(1)",
        "    time.sleep_us(10)",
        "    trig.value(0)",
        "    while not echo.value():",
        "        pass",
        "    start = time.ticks_us()",
        "    while echo.value():",
        "        pass",
        "    stop = time.ticks_us()",
        "    t = time.ticks_diff(stop, start) // 2",
        "    return int(340 * t // 10000)",
        "",
        "",
        "def show(a, b):",
        "    oled.fill(0)",
        "    oled.text(a, 0, 20)",
        "    oled.text(b, 0, 36)",
        "    oled.show()",
        "",
        "",
        "time.sleep(2)",
        'show("AUTO DOOR", "Come closer")',
        "while True:",
        "    d = get_distance()",
        "    if d < 15:",
        '        show("DOOR OPEN", str(d) + " cm")',
        "        servo.duty_u16(8100)",
        "        time.sleep(3)",
        '        show("DOOR CLOSE", "Bye~")',
        "        servo.duty_u16(1638)",
        "        time.sleep(1)",
        '        show("AUTO DOOR", "Come closer")',
        "    time.sleep_ms(300)",
        "",
      ].join("\n"),
    );
  });

  it("practice_near: print 두 인자와 if 안 print", () => {
    const code = workspaceJsonToCode(
      program(
        [
          forever([
            { type: "variables_set", fields: { VAR: { id: "var_d" } }, inputs: { VALUE: { block: { type: "esp_distance" } } } },
            { type: "esp_print2", inputs: { A: { block: varGet("d") }, B: { block: str("cm") } } },
            {
              type: "controls_if",
              inputs: {
                IF0: { block: { type: "logic_compare", fields: { OP: "LT" }, inputs: { A: { block: varGet("d") }, B: { block: num(15) } } } },
                DO0: { block: { type: "esp_print", inputs: { VALUE: { block: str("가까워요!") } } } },
              },
            },
          ]),
        ],
        { vars: ["d"] },
      ),
    );
    expect(code).toContain('    print(d, "cm")\n    if d < 15:\n        print("가까워요!")\n');
  });
});

describe("식과 우선순위", () => {
  const arith = (op: string, a: B, b: B): B => ({ type: "calc_arith", fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } } });
  const setT = (value: B): B => ({ type: "variables_set", fields: { VAR: { id: "var_t" } }, inputs: { VALUE: { block: value } } });
  const body = (value: B) => workspaceJsonToCode(program([setT(value)], { vars: ["t"] })).trim();

  it("같은 우선순위는 왼쪽부터, 괄호 없이", () => {
    expect(body(arith("FLOORDIV", arith("MULTIPLY", num(340), varGet("t")), num(10000)))).toBe("t = 340 * t // 10000");
  });
  it("낮은 우선순위가 안에 있으면 괄호", () => {
    expect(body(arith("MULTIPLY", arith("ADD", num(1), num(2)), num(3)))).toBe("t = (1 + 2) * 3");
    expect(body(arith("MINUS", num(1), arith("MINUS", num(2), num(3))))).toBe("t = 1 - (2 - 3)");
  });
  it("코드 식은 그대로, time. 이 보이면 import time", () => {
    const code = workspaceJsonToCode(program([setT({ type: "code_expr", fields: { CODE: "time.ticks_us()" } })], { vars: ["t"] }));
    expect(code).toBe("import time\n\nt = time.ticks_us()\n");
  });
  it("문자열은 큰따옴표", () => {
    expect(workspaceJsonToCode(program([{ type: "esp_print", inputs: { VALUE: { block: str('He said "hi"') } } }]))).toBe('print("He said \\"hi\\"")\n');
  });
  it("~이 될 때까지 반복과 빈 몸통", () => {
    const code = workspaceJsonToCode(
      program([{ type: "controls_whileUntil", fields: { MODE: "UNTIL" }, inputs: { BOOL: { block: { type: "esp_pin_read", fields: { VAR: { id: "var_echo" } } } } } }], { vars: ["echo"] }),
    );
    expect(code).toBe("while not echo.value():\n    pass\n");
  });
  it("블록 코멘트는 줄 끝 주석으로", () => {
    const code = workspaceJsonToCode(
      program([{ type: "esp_pin_write", fields: { VAR: { id: "var_led" }, VALUE: "1" }, icons: { comment: { text: "켜기", pinned: false, height: 80, width: 160 } } }], { vars: ["led"] }),
    );
    expect(code).toBe("led.value(1)  # 켜기\n");
  });
  it("함수 안에 global 선언을 넣지 않고 반환형 함수를 만든다", () => {
    const def: B = {
      type: "procedures_defreturn", x: 0, y: 0, extraState: { params: [] }, fields: { NAME: "twice" },
      inputs: { RETURN: { block: arith("MULTIPLY", varGet("t"), num(2)) } },
    };
    const code = workspaceJsonToCode(program([setT(num(1))], { tops: [def], vars: ["t"] }));
    expect(code).toBe("def twice():\n    return t * 2\n\n\nt = 1\n");
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `npm test -- src/codegen/codegen`
Expected: FAIL — `./index` 없음.

- [ ] **Step 7: 생성기 클래스**

`src/codegen/generator.ts`:
```ts
import * as Blockly from "blockly";
import { PythonGenerator, pythonGenerator } from "blockly/python";
import { collectImports } from "./imports";

/**
 * 수업 저장소 코드 모양을 내는 MicroPython 생성기.
 * - 들여쓰기 4칸, 변수 `= None` 선언 없음
 * - 준비(setup) 블록은 setupLines 에 모아 코드 맨 위(import 바로 아래)에 둔다
 * - 도우미 함수(provideFunction_) → 사용자 함수(procedures) → 본문 순서
 * - 블록 코멘트는 줄 끝 `# ...` 로
 */
export class MicroPythonGenerator extends PythonGenerator {
  setupLines: string[] = [];

  constructor() {
    super("MicroPython");
    this.INDENT = "    ";
    Object.assign(this.forBlock, pythonGenerator.forBlock);
  }

  override init(workspace: Blockly.Workspace): void {
    super.init(workspace);
    delete this.definitions_["variables"];
    this.setupLines = [];
  }

  /** 준비 블록이 부르는 함수. 같은 줄은 한 번만 넣는다. */
  addSetup(...lines: string[]): void {
    for (const line of lines) if (!this.setupLines.includes(line)) this.setupLines.push(line);
  }

  // definitions_ / provideFunction_ / scrub_ 는 protected 라서 forBlock.ts 가 쓸 공개 창구를 둔다
  setDefinition(name: string, code: string): void { this.definitions_[name] = code; }
  provideHelper(name: string, lines: string[]): string { return this.provideFunction_(name, lines); }
  scrubBlock(block: Blockly.Block, code: string): string { return this.scrub_(block, code, true); }

  override finish(code: string): string {
    const helpers: string[] = [];
    const defs: string[] = [];
    for (const name of Object.keys(this.definitions_)) {
      const def = this.definitions_[name];
      if (/^(from\s+\S+\s+)?import\s+\S+/.test(def)) continue; // import 는 collectImports 가 다시 계산
      (name.startsWith("%") ? defs : helpers).push(def.replace(/\n+$/, ""));
    }
    this.isInitialized = false;
    this.nameDB_?.reset();

    const body = code.replace(/\n+$/, "");
    const sections: string[] = [];
    if (this.setupLines.length) sections.push(this.setupLines.join("\n"));
    const functions = [...helpers, ...defs];
    if (functions.length) sections.push(functions.join("\n\n\n"));
    if (body) sections.push(body);
    const text = sections.join(sections.length > 1 && functions.length ? "\n\n\n" : "\n\n");
    const imports = collectImports([this.setupLines.join("\n"), ...functions, body].join("\n"));
    const out = (imports.length ? imports.join("\n") + "\n\n" : "") + text;
    return out.trim() ? out.replace(/\n*$/, "\n") : "";
  }

  override scrub_(block: Blockly.Block, code: string, thisOnly = false): string {
    const comment = block.getCommentText();
    if (comment && code && !block.outputConnection) {
      const nl = code.indexOf("\n");
      code = nl >= 0 ? `${code.slice(0, nl)}  # ${comment}${code.slice(nl)}` : `${code}  # ${comment}`;
    }
    const next = block.nextConnection?.targetBlock();
    return thisOnly || !next ? code : code + this.blockToCode(next);
  }
}
```
주의: `finish`의 구분자 규칙은 "함수가 있으면 구역 사이를 빈 줄 2개, 없으면 빈 줄 1개"다. Step 5의 기대 문자열(`step1_led_on`은 setup과 본문 사이 빈 줄 1개, `mission3_sos`는 빈 줄 2개)이 이 규칙을 정의한다. 구현 후 기대 문자열과 다르면 **기대 문자열이 아니라 규칙 구현**을 고친다.

- [ ] **Step 8: 블록별 생성기**

`src/codegen/forBlock.ts`:
```ts
import type * as Blockly from "blockly";
import { Order } from "blockly/python";
import type { MicroPythonGenerator } from "./generator";

type Gen = MicroPythonGenerator;
const varName = (block: Blockly.Block, gen: Gen, field = "VAR") => gen.getVariableName(block.getFieldValue(field));
const value = (block: Blockly.Block, gen: Gen, name: string, order = Order.NONE, fallback = "0") => gen.valueToCode(block, name, order) || fallback;
const branch = (block: Blockly.Block, gen: Gen, name: string) => gen.statementToCode(block, name) || gen.PASS;

const ARITH: Record<string, [string, number]> = {
  ADD: ["+", Order.ADDITIVE], MINUS: ["-", Order.ADDITIVE],
  MULTIPLY: ["*", Order.MULTIPLICATIVE], DIVIDE: ["/", Order.MULTIPLICATIVE],
  FLOORDIV: ["//", Order.MULTIPLICATIVE], MOD: ["%", Order.MULTIPLICATIVE],
};

/** 왼쪽은 같은 우선순위에 괄호를 치지 않도록 order + 0.1, 오른쪽은 그대로 */
function binary(block: Blockly.Block, gen: Gen, symbol: string, order: number): [string, number] {
  const a = value(block, gen, "A", order + 0.1);
  const b = value(block, gen, "B", order);
  return [`${a} ${symbol} ${b}`, order];
}

const GET_DISTANCE_BODY = [
  "trig.value(1)", "time.sleep_us(10)", "trig.value(0)",
  "while not echo.value():", "    pass",
  "start = time.ticks_us()",
  "while echo.value():", "    pass",
  "stop = time.ticks_us()",
  "t = time.ticks_diff(stop, start) // 2",
  "return int(340 * t // 10000)",
];
const SHOW_BODY = ["oled.fill(0)", "oled.text(a, 0, 20)", "oled.text(b, 0, 36)", "oled.show()"];

export function registerForBlocks(gen: Gen): void {
  const f = gen.forBlock;

  f["start_program"] = (block, g) => {
    const first = block.getInputTargetBlock("BODY");
    return first ? (g.blockToCode(first) as string) : "";
  };

  f["flow_repeat_forever"] = (block, g) => `while True:\n${branch(block, g as Gen, "DO")}`;
  f["flow_repeat_n"] = (block, g) => `for i in range(${value(block, g as Gen, "TIMES")}):\n${branch(block, g as Gen, "DO")}`;
  f["flow_wait"] = (block, g) => `time.sleep(${value(block, g as Gen, "SEC")})\n`;
  f["flow_wait_ms"] = (block, g) => `time.sleep_ms(${value(block, g as Gen, "MS")})\n`;
  f["flow_wait_us"] = (block, g) => `time.sleep_us(${value(block, g as Gen, "US")})\n`;

  f["calc_arith"] = (block, g) => {
    const [symbol, order] = ARITH[block.getFieldValue("OP")] ?? ARITH.ADD;
    return binary(block, g as Gen, symbol, order);
  };
  f["calc_concat"] = (block, g) => binary(block, g as Gen, "+", Order.ADDITIVE);
  f["calc_str"] = (block, g) => [`str(${value(block, g as Gen, "X")})`, Order.FUNCTION_CALL];
  f["calc_int"] = (block, g) => [`int(${value(block, g as Gen, "X")})`, Order.FUNCTION_CALL];

  // 내장 text 는 작은따옴표를 쓰므로 큰따옴표로 바꾼다
  f["text"] = (block) => {
    const raw = String(block.getFieldValue("TEXT"));
    const escaped = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
    return [`"${escaped}"`, Order.ATOMIC];
  };

  // 내장 함수 정의는 global 선언을 넣으므로 덮어쓴다
  const defGenerator = (block: Blockly.Block, g: Gen) => {
    const name = g.getProcedureName(block.getFieldValue("NAME"));
    const params = block.getVarModels().map((v) => g.getVariableName(v.getId()));
    let body = g.statementToCode(block, "STACK");
    const ret = block.getInput("RETURN") ? g.valueToCode(block, "RETURN", Order.NONE) : "";
    const returnLine = ret ? `${g.INDENT}return ${ret}\n` : "";
    if (!body && !returnLine) body = g.PASS;
    const code = `def ${name}(${params.join(", ")}):\n${body}${returnLine}`;
    g.setDefinition(`%${name}`, g.scrubBlock(block, code));
    return null;
  };
  f["procedures_defnoreturn"] = (block, g) => defGenerator(block, g as Gen);
  f["procedures_defreturn"] = (block, g) => defGenerator(block, g as Gen);

  f["esp_pin_setup"] = (block, g) => {
    (g as Gen).addSetup(`${varName(block, g as Gen)} = Pin(${block.getFieldValue("PIN")}, Pin.${block.getFieldValue("MODE")})`);
    return "";
  };
  f["esp_pin_write"] = (block, g) => `${varName(block, g as Gen)}.value(${block.getFieldValue("VALUE")})\n`;
  f["esp_pin_read"] = (block, g) => [`${varName(block, g as Gen)}.value()`, Order.FUNCTION_CALL];

  f["esp_pwm_setup"] = (block, g) => {
    const name = varName(block, g as Gen);
    (g as Gen).addSetup(`${name} = PWM(Pin(${block.getFieldValue("PIN")}))`, `${name}.freq(${block.getFieldValue("FREQ")})`);
    return "";
  };
  f["esp_servo_setup"] = (block, g) => {
    const name = varName(block, g as Gen);
    (g as Gen).addSetup(`${name} = PWM(Pin(${block.getFieldValue("PIN")}))`, `${name}.freq(50)`, `${name}.duty_u16(1638)`);
    return "";
  };
  f["esp_pwm_duty"] = (block, g) => `${varName(block, g as Gen)}.duty_u16(${value(block, g as Gen, "DUTY")})\n`;
  f["esp_servo_door"] = (block, g) => `${varName(block, g as Gen)}.duty_u16(${block.getFieldValue("ACTION")})\n`;

  f["esp_ultrasonic_setup"] = (block, g) => {
    const gen = g as Gen;
    gen.addSetup(`trig = Pin(${block.getFieldValue("TRIG")}, Pin.OUT)`, `echo = Pin(${block.getFieldValue("ECHO")}, Pin.IN)`);
    gen.provideHelper("get_distance", [`def ${gen.FUNCTION_NAME_PLACEHOLDER_}():`, ...GET_DISTANCE_BODY.map((l) => gen.INDENT + l)]);
    return "";
  };
  f["esp_distance"] = () => ["get_distance()", Order.FUNCTION_CALL];

  f["esp_oled_setup"] = (block, g) => {
    const gen = g as Gen;
    gen.addSetup(`i2c = SoftI2C(scl=Pin(${block.getFieldValue("SCL")}), sda=Pin(${block.getFieldValue("SDA")}))`, "oled = ssd1306.SSD1306_I2C(128, 64, i2c)");
    gen.provideHelper("show", [`def ${gen.FUNCTION_NAME_PLACEHOLDER_}(a, b):`, ...SHOW_BODY.map((l) => gen.INDENT + l)]);
    return "";
  };
  f["esp_oled_show"] = (block, g) => `show(${value(block, g as Gen, "A", Order.NONE, '""')}, ${value(block, g as Gen, "B", Order.NONE, '""')})\n`;

  f["esp_print"] = (block, g) => `print(${value(block, g as Gen, "VALUE", Order.NONE, '""')})\n`;
  f["esp_print2"] = (block, g) => `print(${value(block, g as Gen, "A", Order.NONE, '""')}, ${value(block, g as Gen, "B", Order.NONE, '""')})\n`;

  f["code_stmt"] = (block) => `${block.getFieldValue("CODE")}\n`;
  f["code_expr"] = (block) => [String(block.getFieldValue("CODE")), Order.ATOMIC];
}
```

`src/codegen/index.ts`:
```ts
import * as Blockly from "blockly";
import { registerBlocks } from "@/blocks";
import { MicroPythonGenerator } from "./generator";
import { registerForBlocks } from "./forBlock";

export { collectImports } from "./imports";
export { MicroPythonGenerator };
export type WorkspaceJson = ReturnType<typeof Blockly.serialization.workspaces.save>;

export function createGenerator(): MicroPythonGenerator {
  registerBlocks();
  const gen = new MicroPythonGenerator();
  registerForBlocks(gen);
  return gen;
}

let shared: MicroPythonGenerator | null = null;

/** 작업판 전체를 MicroPython 코드로 */
export function generateCode(workspace: Blockly.Workspace): string {
  shared ??= createGenerator();
  return shared.workspaceToCode(workspace);
}

/** 직렬화 JSON을 헤드리스 작업판에 올려 코드로 바꾼다 (테스트·동기화용) */
export function workspaceJsonToCode(json: WorkspaceJson): string {
  registerBlocks();
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    return generateCode(ws);
  } finally {
    ws.dispose();
  }
}
```

- [ ] **Step 9: 테스트 통과까지 고치기**

Run: `npm test -- src/codegen`
Expected: PASS. 실패하면 먼저 실제 출력을 `console.log`로 보고, 빈 줄 구분 규칙(Step 7 주의)과 `provideFunction_` 이름 치환(`FUNCTION_NAME_PLACEHOLDER_`가 `get_distance`로 바뀌는지)을 확인한다. `procedures_callnoreturn` 호출 블록을 헤드리스에서 올릴 때 정의 블록이 먼저 배열에 있어야 한다(테스트는 `tops`를 앞에 둔다).

- [ ] **Step 10: 커밋**

Run: `npm run build`
```bash
git add src/codegen
git commit -m "블록 → MicroPython 생성기: 수업 저장소 코드 모양, 준비 블록 끌어올리기, 도우미 함수

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: MicroPython → 블록 파서와 왕복 테스트

**Files:**
- Create: `src/parser/types.ts`, `src/parser/tree.ts`, `src/parser/normalize.ts`, `src/parser/builders.ts`, `src/parser/context.ts`, `src/parser/patterns.ts`, `src/parser/expressions.ts`, `src/parser/statements.ts`, `src/parser/index.ts`
- Create(내용 복사): `content/chapters/01-led/*.py`(7개), `content/chapters/10-auto-door/*.py`(7개)
- Test: `src/parser/normalize.test.ts`, `src/parser/parser.test.ts`, `src/parser/roundtrip.test.ts`

**Interfaces:**
- Consumes: Task 3의 `workspaceJsonToCode(json)`, `type WorkspaceJson`; Task 2의 블록 type·필드 이름.
- Produces:
  - `codeToBlocks(code: string): ParseResult`
  - `type ParseResult = { ok: true; json: WorkspaceJson; unparsed: UnparsedItem[] } | { ok: false; error: { line: number; message: string } }`
  - `type UnparsedItem = { line: number; text: string }` — `code_stmt`/`code_expr`로 떨어진 조각(1-based 줄 번호)
  - `normalizeCode(code: string): string[]` — 주석·빈 줄·끝 공백을 뗀 줄 배열(왕복 비교·판정용)
  - 파서는 Blockly를 import하지 않는다(`import type`만 허용).

- [ ] **Step 1: 수업 저장소 코드 파일 가져오기**

```bash
cd /Users/lucas/works/python_projects/esp32-blocklab
mkdir -p content/chapters/01-led content/chapters/10-auto-door
for f in step1_led_on step2_led_off step3_blink_once step4_blink_loop mission1_slow_blink mission2_fast_blink mission3_sos; do
  gh api "repos/SangWon7242/esp32-micropython-class/contents/01_LED켜기/code/$f.py" --jq .content | base64 -d > "content/chapters/01-led/$f.py"
done
for f in step1_distance step2_door step3_auto_door practice_near mission_show_distance extra1_led extra2_wait_until_away; do
  gh api "repos/SangWon7242/esp32-micropython-class/contents/10_자동문/code/$f.py" --jq .content | base64 -d > "content/chapters/10-auto-door/$f.py"
done
ls content/chapters/*/ | wc -l   # 파일 14개 + 디렉터리 줄
```

- [ ] **Step 2: normalize 테스트와 구현**

`src/parser/normalize.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { normalizeCode, stripComment } from "./normalize";

describe("normalizeCode", () => {
  it("주석·빈 줄·끝 공백을 떼고 들여쓰기는 남긴다", () => {
    const src = 'from machine import Pin   # 핀\n\nled = Pin(26, Pin.OUT)\n\nwhile True:   \n    led.value(1)  # 켜기\n';
    expect(normalizeCode(src)).toEqual(["from machine import Pin", "led = Pin(26, Pin.OUT)", "while True:", "    led.value(1)"]);
  });
  it("문자열 안의 #은 주석이 아니다", () => {
    expect(stripComment('print("a # b")  # c')).toBe('print("a # b")  ');
    expect(stripComment("x = '#'")).toBe("x = '#'");
  });
});
```

`src/parser/normalize.ts`:
```ts
/** 문자열 밖의 # 부터 끝까지 지운다 */
export function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "#") return line.slice(0, i);
  }
  return line;
}

/** 주석·빈 줄·끝 공백을 뗀 줄 배열. 왕복 비교와 미션 판정이 쓴다. */
export function normalizeCode(code: string): string[] {
  return code
    .replace(/\t/g, "    ")
    .split("\n")
    .map((line) => stripComment(line).replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);
}
```
Run: `npm test -- src/parser/normalize` → PASS.

- [ ] **Step 3: 파서 단위 테스트 작성**

`src/parser/parser.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { codeToBlocks } from "./index";
import type { BlockJson } from "./types";

function parse(code: string) {
  const r = codeToBlocks(code);
  if (!r.ok) throw new Error(`parse failed: ${r.error.message} (line ${r.error.line})`);
  return r;
}
/** start_program 몸통을 배열로 편다 */
function body(code: string): BlockJson[] {
  const r = parse(code);
  const start = (r.json.blocks.blocks as BlockJson[]).find((b) => b.type === "start_program");
  const out: BlockJson[] = [];
  let cur = start?.inputs?.BODY?.block;
  while (cur) { out.push(cur); cur = cur.next?.block; }
  return out;
}
const tops = (code: string) => (parse(code).json.blocks.blocks as BlockJson[]).filter((b) => b.type !== "start_program");

describe("설정 패턴", () => {
  it("Pin 대입은 esp_pin_setup, 알려진 import는 사라진다", () => {
    const b = body("from machine import Pin\nled = Pin(26, Pin.OUT)\n");
    expect(b).toHaveLength(1);
    expect(b[0].type).toBe("esp_pin_setup");
    expect(b[0].fields).toEqual({ PIN: 26, MODE: "OUT", VAR: { id: "var_led" } });
  });
  it("PWM + freq(50) + duty_u16(1638)은 서보 준비 하나로 접힌다", () => {
    const b = body("servo = PWM(Pin(4))\nservo.freq(50)\nservo.duty_u16(1638)\n");
    expect(b.map((x) => x.type)).toEqual(["esp_servo_setup"]);
    expect(b[0].fields).toEqual({ VAR: { id: "var_servo" }, PIN: 4 });
  });
  it("PWM + freq 만 있으면 esp_pwm_setup", () => {
    const b = body("pwm = PWM(Pin(2))\npwm.freq(1000)\npwm.duty_u16(300)\n");
    expect(b.map((x) => x.type)).toEqual(["esp_pwm_setup", "esp_pwm_duty"]);
    expect(b[0].fields).toEqual({ VAR: { id: "var_pwm" }, PIN: 2, FREQ: 1000 });
  });
  it("표준 get_distance 가 있으면 초음파 준비로 접힌다", () => {
    const src = [
      "trig = Pin(13, Pin.OUT)", "echo = Pin(12, Pin.IN)", "",
      "def get_distance():", "    trig.value(1)", "    time.sleep_us(10)", "    trig.value(0)",
      "    while not echo.value():", "        pass", "    start = time.ticks_us()",
      "    while echo.value():", "        pass", "    stop = time.ticks_us()",
      "    t = time.ticks_diff(stop, start) // 2", "    return int(340 * t // 10000)", "",
      "d = get_distance()", "",
    ].join("\n");
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["esp_ultrasonic_setup", "variables_set"]);
    expect(b[0].fields).toEqual({ TRIG: 13, ECHO: 12 });
    expect(b[1].inputs?.VALUE?.block?.type).toBe("esp_distance");
    expect(tops(src)).toHaveLength(0);
  });
  it("본문이 다른 get_distance 는 사용자 함수로 남는다", () => {
    const src = [
      "trig = Pin(13, Pin.OUT)", "echo = Pin(12, Pin.IN)",
      "def get_distance():", "    t = time.ticks_diff(stop, start)", "    t = t // 2", "    return int(340 * t // 10000)",
      'print(get_distance(), "cm")', "",
    ].join("\n");
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["esp_pin_setup", "esp_pin_setup", "esp_print2"]);
    expect(b[2].inputs?.A?.block?.type).toBe("procedures_callreturn");
    const def = tops(src)[0];
    expect(def.type).toBe("procedures_defreturn");
    expect(def.fields).toEqual({ NAME: "get_distance" });
    expect(def.inputs?.RETURN?.block?.type).toBe("calc_int");
    const r = parse(src);
    expect(r.unparsed.map((u) => u.text)).toEqual(["time.ticks_diff(stop, start)"]);
  });
  it("OLED 준비와 표준 show 는 접히고 show 호출은 esp_oled_show", () => {
    const src = [
      "i2c = SoftI2C(scl=Pin(22), sda=Pin(21))", "oled = ssd1306.SSD1306_I2C(128, 64, i2c)",
      "def show(a, b):", "    oled.fill(0)", "    oled.text(a, 0, 20)", "    oled.text(b, 0, 36)", "    oled.show()",
      'show("AUTO DOOR", str(d) + " cm")', "",
    ].join("\n");
    const b = body(src);
    expect(b.map((x) => x.type)).toEqual(["esp_oled_setup", "esp_oled_show"]);
    const second = b[1].inputs?.B?.block;
    expect(second?.type).toBe("calc_concat");
    expect(second?.inputs?.A?.block?.type).toBe("calc_str");
  });
});

describe("문장", () => {
  it("while True / for range / 기다리기", () => {
    const b = body("while True:\n    led.value(1)\n    time.sleep(1)\n    for i in range(3):\n        time.sleep_ms(500)\n");
    expect(b[0].type).toBe("flow_repeat_forever");
    let cur = b[0].inputs?.DO?.block;
    const types: string[] = [];
    while (cur) { types.push(cur.type); cur = cur.next?.block; }
    expect(types).toEqual(["code_stmt", "flow_wait", "flow_repeat_n"]); // led 가 핀으로 선언되지 않았으므로 code_stmt
  });
  it("선언된 핀의 value(1)은 esp_pin_write", () => {
    const b = body("led = Pin(26, Pin.OUT)\nled.value(1)\nled.value(0)\n");
    expect(b.slice(1).map((x) => [x.type, x.fields?.VALUE])).toEqual([["esp_pin_write", "1"], ["esp_pin_write", "0"]]);
  });
  it("if / elif / else 와 비교·논리", () => {
    const b = body("d = 3\nif d < 15 and d > 0:\n    print(d)\nelif d == 0:\n    print(0)\nelse:\n    pass\n");
    const iff = b[1];
    expect(iff.type).toBe("controls_if");
    expect(iff.extraState).toEqual({ elseIfCount: 1, hasElse: true });
    const cond = iff.inputs?.IF0?.block;
    expect(cond?.type).toBe("logic_operation");
    expect(cond?.fields).toEqual({ OP: "AND" });
    expect(cond?.inputs?.A?.block?.fields).toEqual({ OP: "LT" });
    expect(iff.inputs?.IF1?.block?.fields).toEqual({ OP: "EQ" });
    expect(iff.inputs?.DO0?.block?.type).toBe("esp_print");
    expect(iff.inputs?.ELSE).toBeUndefined(); // pass 만 있는 몸통은 비어 있다
  });
  it("while not X: pass → 될 때까지 반복", () => {
    const b = body("echo = Pin(12, Pin.IN)\nwhile not echo.value():\n    pass\n");
    expect(b[1].type).toBe("controls_whileUntil");
    expect(b[1].fields).toEqual({ MODE: "UNTIL" });
    expect(b[1].inputs?.BOOL?.block?.type).toBe("esp_pin_read");
    expect(b[1].inputs?.DO).toBeUndefined();
  });
  it("함수 정의·매개변수·호출", () => {
    const src = "def blink(t):\n    time.sleep(t)\n\nblink(0.2)\n";
    const def = tops(src)[0];
    expect(def.type).toBe("procedures_defnoreturn");
    expect(def.extraState).toEqual({ params: [{ name: "t", id: "var_t" }] });
    expect(def.inputs?.STACK?.block?.inputs?.SEC?.block).toEqual({ type: "variables_get", fields: { VAR: { id: "var_t" } } });
    const call = body(src)[0];
    expect(call.type).toBe("procedures_callnoreturn");
    expect(call.extraState).toEqual({ name: "blink", params: ["t"] });
    expect(call.inputs?.ARG0?.block).toEqual({ type: "math_number", fields: { NUM: 0.2 } });
  });
  it("줄 끝 주석은 블록 코멘트로", () => {
    const b = body("led = Pin(26, Pin.OUT)\nled.value(1)   # 켜기\nwhile True:  # 계속\n    pass\n");
    expect(b[1].icons?.comment.text).toBe("켜기");
    expect(b[2].icons?.comment.text).toBe("계속");
  });
  it("모르는 문장은 code_stmt 로, 모르는 식은 code_expr 로", () => {
    const r = parse("x = time.ticks_us()\noled.fill(0)\n");
    const b = body("x = time.ticks_us()\noled.fill(0)\n");
    expect(b[0].type).toBe("variables_set");
    expect(b[0].inputs?.VALUE?.block).toEqual({ type: "code_expr", fields: { CODE: "time.ticks_us()" } });
    expect(b[1]).toEqual({ type: "code_stmt", fields: { CODE: "oled.fill(0)" } });
    expect(r.unparsed.map((u) => u.line)).toEqual([1, 2]);
  });
  it("문법 오류는 ok:false 와 줄 번호", () => {
    const r = codeToBlocks("led = Pin(26, Pin.OUT)\nif d < 15\n    print(d)\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(2);
  });
  it("문자열은 따옴표 종류와 상관없이 내용만 담는다", () => {
    const b = body("print('가까워요!')\nprint(\"a\\\"b\")\n");
    expect(b[0].inputs?.VALUE?.block).toEqual({ type: "text", fields: { TEXT: "가까워요!" } });
    expect(b[1].inputs?.VALUE?.block).toEqual({ type: "text", fields: { TEXT: 'a"b' } });
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npm test -- src/parser/parser`
Expected: FAIL — `./index` 없음.

- [ ] **Step 5: 타입·트리 도우미·빌더·문맥**

`src/parser/types.ts`:
```ts
import type { WorkspaceJson } from "@/codegen";
export type { WorkspaceJson };

export type BlockJson = {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockJson; shadow?: BlockJson }>;
  next?: { block: BlockJson };
  extraState?: unknown;
  icons?: { comment: { text: string; pinned: boolean; height: number; width: number } };
};

export type UnparsedItem = { line: number; text: string };

export type ParseResult =
  | { ok: true; json: WorkspaceJson; unparsed: UnparsedItem[] }
  | { ok: false; error: { line: number; message: string } };
```

`src/parser/tree.ts`:
```ts
import type { SyntaxNode } from "@lezer/common";

export class Source {
  constructor(readonly text: string) {}
  slice(node: SyntaxNode): string { return this.text.slice(node.from, node.to); }
  /** 1-based 줄 번호 */
  lineOf(pos: number): number { return this.text.slice(0, pos).split("\n").length; }
  /** 복합문 전체 텍스트를 첫 줄 들여쓰기 기준으로 내어쓴다 */
  dedent(node: SyntaxNode): string {
    const lineStart = this.text.lastIndexOf("\n", node.from - 1) + 1;
    const indent = node.from - lineStart;
    return this.slice(node).split("\n").map((l, i) => (i === 0 ? l : l.slice(Math.min(indent, l.length - l.trimStart().length)))).join("\n");
  }
}

export function children(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let c = node.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
}

const TOKEN_NAMES = new Set(["(", ")", ",", ":", ".", "=", "AssignOp", "ArithOp", "CompareOp", "and", "or", "not", "in", "for", "while", "if", "elif", "else", "def", "return", "import", "from", "pass", "Comment"]);

/** 토큰(괄호·쉼표·키워드·주석)을 뺀 자식 노드 */
export function operands(node: SyntaxNode): SyntaxNode[] {
  return children(node).filter((c) => !TOKEN_NAMES.has(c.name));
}

/** Body 안의 문장 노드(':' 와 주석 제외) */
export function bodyStatements(body: SyntaxNode): SyntaxNode[] {
  return children(body).filter((c) => c.name !== ":" && c.name !== "Comment");
}
```

`src/parser/builders.ts`:
```ts
import type { BlockJson } from "./types";

export const num = (n: number): BlockJson => ({ type: "math_number", fields: { NUM: n } });
export const str = (s: string): BlockJson => ({ type: "text", fields: { TEXT: s } });
export const bool = (b: boolean): BlockJson => ({ type: "logic_boolean", fields: { BOOL: b ? "TRUE" : "FALSE" } });
export const varGet = (id: string): BlockJson => ({ type: "variables_get", fields: { VAR: { id } } });
export const varSet = (id: string, value: BlockJson): BlockJson => ({ type: "variables_set", fields: { VAR: { id } }, inputs: { VALUE: { block: value } } });
export const codeExpr = (code: string): BlockJson => ({ type: "code_expr", fields: { CODE: code } });
export const codeStmt = (code: string): BlockJson => ({ type: "code_stmt", fields: { CODE: code } });

export function block(type: string, fields?: Record<string, unknown>, inputs?: Record<string, BlockJson | undefined>, extraState?: unknown): BlockJson {
  const out: BlockJson = { type };
  if (fields && Object.keys(fields).length) out.fields = fields;
  if (inputs) {
    const entries = Object.entries(inputs).filter(([, v]) => v !== undefined) as [string, BlockJson][];
    if (entries.length) out.inputs = Object.fromEntries(entries.map(([k, v]) => [k, { block: v }]));
  }
  if (extraState !== undefined) out.extraState = extraState;
  return out;
}

/** 명령 블록 배열을 next 로 잇고 머리를 돌려준다. 빈 배열이면 undefined */
export function chain(blocks: BlockJson[]): BlockJson | undefined {
  if (!blocks.length) return undefined;
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}

export function withComment(b: BlockJson, text: string | null): BlockJson {
  if (text) b.icons = { comment: { text, pinned: false, height: 80, width: 160 } };
  return b;
}
```

`src/parser/context.ts`:
```ts
import type { SyntaxNode } from "@lezer/common";
import { Source } from "./tree";
import type { UnparsedItem } from "./types";

export type FunctionInfo = { params: string[]; returns: boolean };

/** 한 번 파싱하는 동안의 상태: 변수·핀·PWM·함수 표와 접기 여부 */
export class ParseContext {
  readonly src: Source;
  readonly variables = new Map<string, string>();
  readonly pins = new Set<string>();
  readonly pwms = new Set<string>();
  readonly servos = new Set<string>();
  readonly functions = new Map<string, FunctionInfo>();
  readonly unparsed: UnparsedItem[] = [];
  ultrasonicFolded = false;
  oledFolded = false;
  echoPin = 12;

  constructor(text: string) { this.src = new Source(text); }

  varId(name: string): string {
    if (!this.variables.has(name)) this.variables.set(name, `var_${name}`);
    return this.variables.get(name)!;
  }
  hasVar(name: string): boolean { return this.variables.has(name); }

  markUnparsed(node: SyntaxNode, text = this.src.slice(node)): void {
    this.unparsed.push({ line: this.src.lineOf(node.from), text });
  }
}
```

- [ ] **Step 6: 패턴 인식**

`src/parser/patterns.ts`:
```ts
import type { SyntaxNode } from "@lezer/common";
import { bodyStatements, children } from "./tree";
import { normalizeCode } from "./normalize";
import type { ParseContext } from "./context";

export const STANDARD_GET_DISTANCE = [
  "trig.value(1)", "time.sleep_us(10)", "trig.value(0)", "while not echo.value():", "pass",
  "start = time.ticks_us()", "while echo.value():", "pass", "stop = time.ticks_us()",
  "t = time.ticks_diff(stop, start) // 2", "return int(340 * t // 10000)",
];
export const STANDARD_SHOW = ["oled.fill(0)", "oled.text(a, 0, 20)", "oled.text(b, 0, 36)", "oled.show()"];

export const RE_PIN_SETUP = /^(\w+)\s*=\s*Pin\(\s*(\d+)\s*,\s*Pin\.(OUT|IN)\s*\)$/;
export const RE_PWM_SETUP = /^(\w+)\s*=\s*PWM\(\s*Pin\(\s*(\d+)\s*\)\s*\)$/;
export const RE_FREQ = /^(\w+)\.freq\(\s*(\d+)\s*\)$/;
export const RE_DUTY = /^(\w+)\.duty_u16\(\s*(\d+)\s*\)$/;
export const RE_I2C_SETUP = /^i2c\s*=\s*SoftI2C\(\s*scl\s*=\s*Pin\(\s*(\d+)\s*\)\s*,\s*sda\s*=\s*Pin\(\s*(\d+)\s*\)\s*\)$/;
export const RE_OLED_SETUP = /^oled\s*=\s*ssd1306\.SSD1306_I2C\(\s*128\s*,\s*64\s*,\s*i2c\s*\)$/;
export const RE_KNOWN_IMPORT = /^(from\s+machine\s+import\s+[\w,\s]+|import\s+time|import\s+ssd1306)$/;

/** 함수 몸통의 문장들을 주석 없이, 들여쓰기 없이 한 줄씩 */
export function bodyLines(body: SyntaxNode, ctx: ParseContext): string[] {
  return bodyStatements(body).flatMap((s) => normalizeCode(ctx.src.slice(s)).map((l) => l.trim()));
}

export function isStandardBody(body: SyntaxNode, ctx: ParseContext, standard: string[]): boolean {
  const lines = bodyLines(body, ctx);
  return lines.length === standard.length && lines.every((l, i) => l === standard[i]);
}

export function functionParts(def: SyntaxNode, ctx: ParseContext): { name: string; params: string[]; body: SyntaxNode | null } {
  const kids = children(def);
  const nameNode = kids.find((k) => k.name === "VariableName");
  const paramList = kids.find((k) => k.name === "ParamList");
  const body = kids.find((k) => k.name === "Body") ?? null;
  const params = paramList ? children(paramList).filter((p) => p.name === "VariableName").map((p) => ctx.src.slice(p)) : [];
  return { name: nameNode ? ctx.src.slice(nameNode) : "", params, body };
}
```

- [ ] **Step 7: 식 변환**

`src/parser/expressions.ts`:
```ts
import type { SyntaxNode } from "@lezer/common";
import { block, bool, codeExpr, num, str, varGet } from "./builders";
import type { ParseContext } from "./context";
import { children, operands } from "./tree";
import type { BlockJson } from "./types";

const COMPARE: Record<string, string> = { "<": "LT", ">": "GT", "==": "EQ", "!=": "NEQ", "<=": "LTE", ">=": "GTE" };
const ARITH: Record<string, string> = { "+": "ADD", "-": "MINUS", "*": "MULTIPLY", "/": "DIVIDE", "//": "FLOORDIV", "%": "MOD" };

export function decodeString(literal: string): string {
  const quote = literal[0];
  const inner = literal.slice(1, -1);
  try {
    if (quote === '"') return JSON.parse(literal) as string;
    return JSON.parse(`"${inner.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`) as string;
  } catch {
    return inner;
  }
}

/** 호출식의 (피호출자, 인자 노드들) */
export function callParts(call: SyntaxNode): { callee: SyntaxNode; args: SyntaxNode[] } {
  const kids = children(call);
  const argList = kids.find((k) => k.name === "ArgList");
  return { callee: kids[0], args: argList ? operands(argList) : [] };
}

/** obj.method 꼴이면 이름 둘을 돌려준다 */
export function memberParts(node: SyntaxNode, ctx: ParseContext): { obj: string; prop: string } | null {
  if (node.name !== "MemberExpression") return null;
  const kids = children(node);
  if (kids.length !== 3 || kids[0].name !== "VariableName" || kids[2].name !== "PropertyName") return null;
  return { obj: ctx.src.slice(kids[0]), prop: ctx.src.slice(kids[2]) };
}

const isStringy = (node: SyntaxNode, ctx: ParseContext) =>
  node.name === "String" || (node.name === "CallExpression" && ctx.src.slice(callParts(node).callee) === "str");

function fallback(node: SyntaxNode, ctx: ParseContext): BlockJson {
  ctx.markUnparsed(node);
  return codeExpr(ctx.src.slice(node));
}

export function convertExpr(node: SyntaxNode, ctx: ParseContext): BlockJson {
  const text = ctx.src.slice(node);
  switch (node.name) {
    case "Number": return num(Number(text));
    case "String": return str(decodeString(text));
    case "Boolean": return bool(text === "True");
    case "VariableName": return ctx.hasVar(text) ? varGet(ctx.varId(text)) : fallback(node, ctx);
    case "ParenthesizedExpression": {
      const inner = operands(node)[0];
      return inner ? convertExpr(inner, ctx) : fallback(node, ctx);
    }
    case "UnaryExpression": {
      const kids = children(node);
      const op = ctx.src.slice(kids[0]);
      if (op === "not" && kids[1]) return block("logic_negate", undefined, { BOOL: convertExpr(kids[1], ctx) });
      if (op === "-" && kids[1]?.name === "Number") return num(-Number(ctx.src.slice(kids[1])));
      return fallback(node, ctx);
    }
    case "BinaryExpression": {
      const kids = children(node);
      if (kids.length !== 3) return fallback(node, ctx);
      const [left, opNode, right] = kids;
      const op = ctx.src.slice(opNode);
      if (opNode.name === "CompareOp" && COMPARE[op]) return block("logic_compare", { OP: COMPARE[op] }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      if (opNode.name === "and" || opNode.name === "or") return block("logic_operation", { OP: op.toUpperCase() }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      if (opNode.name === "ArithOp" && ARITH[op]) {
        if (op === "+" && (isStringy(left, ctx) || isStringy(right, ctx))) return block("calc_concat", undefined, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
        return block("calc_arith", { OP: ARITH[op] }, { A: convertExpr(left, ctx), B: convertExpr(right, ctx) });
      }
      return fallback(node, ctx);
    }
    case "CallExpression": {
      const { callee, args } = callParts(node);
      if (callee.name === "VariableName") {
        const name = ctx.src.slice(callee);
        if (name === "str" && args.length === 1) return block("calc_str", undefined, { X: convertExpr(args[0], ctx) });
        if (name === "int" && args.length === 1) return block("calc_int", undefined, { X: convertExpr(args[0], ctx) });
        if (name === "get_distance" && ctx.ultrasonicFolded && args.length === 0) return block("esp_distance");
        const fn = ctx.functions.get(name);
        if (fn && fn.returns && args.length === fn.params.length) return callBlock("procedures_callreturn", name, fn.params, args, ctx);
        return fallback(node, ctx);
      }
      const member = memberParts(callee, ctx);
      if (member && member.prop === "value" && args.length === 0 && ctx.pins.has(member.obj)) return block("esp_pin_read", { VAR: { id: ctx.varId(member.obj) } });
      return fallback(node, ctx);
    }
    default:
      return fallback(node, ctx);
  }
}

export function callBlock(type: "procedures_callreturn" | "procedures_callnoreturn", name: string, params: string[], args: SyntaxNode[], ctx: ParseContext): BlockJson {
  const inputs: Record<string, BlockJson> = {};
  args.forEach((a, i) => { inputs[`ARG${i}`] = convertExpr(a, ctx); });
  return block(type, undefined, inputs, { name, params });
}
```

- [ ] **Step 8: 문장 변환**

`src/parser/statements.ts`:
```ts
import type { SyntaxNode } from "@lezer/common";
import { block, chain, codeStmt, varSet, withComment } from "./builders";
import type { ParseContext } from "./context";
import { callBlock, callParts, convertExpr, memberParts } from "./expressions";
import { RE_DUTY, RE_FREQ, RE_I2C_SETUP, RE_KNOWN_IMPORT, RE_OLED_SETUP, RE_PIN_SETUP, RE_PWM_SETUP, functionParts } from "./patterns";
import { bodyStatements, children, operands } from "./tree";
import type { BlockJson } from "./types";

export type Converted = { blocks: BlockJson[]; tops: BlockJson[]; consumed: number };

/** 문장 첫 줄의 줄 끝 주석을 찾는다 (형제 Comment 또는 Body 첫 Comment) */
function inlineComment(node: SyntaxNode, ctx: ParseContext): string | null {
  const line = ctx.src.lineOf(node.from);
  const candidates: SyntaxNode[] = [];
  for (let s = node.nextSibling; s && s.name === "Comment"; s = s.nextSibling) candidates.push(s);
  const body = children(node).find((k) => k.name === "Body");
  if (body) for (const k of children(body)) if (k.name === "Comment") candidates.push(k);
  const hit = candidates.find((c) => ctx.src.lineOf(c.from) === line);
  return hit ? ctx.src.slice(hit).replace(/^#\s?/, "").trim() : null;
}

export function convertBody(body: SyntaxNode | null, ctx: ParseContext): BlockJson | undefined {
  if (!body) return undefined;
  const stmts = bodyStatements(body);
  if (stmts.every((s) => s.name === "PassStatement")) return undefined;
  return chain(convertStatements(stmts, ctx, false).blocks);
}

export function convertStatements(nodes: SyntaxNode[], ctx: ParseContext, topLevel: boolean): { blocks: BlockJson[]; tops: BlockJson[] } {
  const blocks: BlockJson[] = [];
  const tops: BlockJson[] = [];
  for (let i = 0; i < nodes.length; ) {
    const node = nodes[i];
    if (node.name === "Comment") { i++; continue; }
    const r = convertStatement(node, nodes.slice(i + 1), ctx, topLevel);
    if (r.blocks[0]) withComment(r.blocks[0], inlineComment(node, ctx));
    blocks.push(...r.blocks);
    tops.push(...r.tops);
    i += Math.max(1, r.consumed);
  }
  return { blocks, tops };
}

const one = (b: BlockJson, consumed = 1): Converted => ({ blocks: [b], tops: [], consumed });
const none = (consumed = 1): Converted => ({ blocks: [], tops: [], consumed });
const unknown = (node: SyntaxNode, ctx: ParseContext): Converted => { ctx.markUnparsed(node); return one(codeStmt(ctx.src.dedent(node))); };

function convertStatement(node: SyntaxNode, following: SyntaxNode[], ctx: ParseContext, topLevel: boolean): Converted {
  const text = ctx.src.slice(node).trim();
  switch (node.name) {
    case "ImportStatement":
      return RE_KNOWN_IMPORT.test(text) ? none() : unknown(node, ctx);

    case "AssignStatement": {
      if (topLevel) {
        const pin = RE_PIN_SETUP.exec(text);
        if (pin) {
          if (ctx.ultrasonicFolded && pin[1] === "trig") return one(block("esp_ultrasonic_setup", { TRIG: Number(pin[2]), ECHO: ctx.echoPin }));
          if (ctx.ultrasonicFolded && pin[1] === "echo") return none();
          return one(block("esp_pin_setup", { PIN: Number(pin[2]), MODE: pin[3], VAR: { id: ctx.varId(pin[1]) } }));
        }
        const i2c = RE_I2C_SETUP.exec(text);
        if (i2c && ctx.oledFolded) return one(block("esp_oled_setup", { SCL: Number(i2c[1]), SDA: Number(i2c[2]) }));
        if (RE_OLED_SETUP.test(text) && ctx.oledFolded) return none();
        const pwm = RE_PWM_SETUP.exec(text);
        if (pwm) {
          const [name, pinNo] = [pwm[1], Number(pwm[2])];
          const freq = following[0] ? RE_FREQ.exec(ctx.src.slice(following[0]).trim()) : null;
          const duty = following[1] ? RE_DUTY.exec(ctx.src.slice(following[1]).trim()) : null;
          if (freq && freq[1] === name) {
            if (freq[2] === "50" && duty && duty[1] === name && duty[2] === "1638") return one(block("esp_servo_setup", { VAR: { id: ctx.varId(name) }, PIN: pinNo }), 3);
            return one(block("esp_pwm_setup", { VAR: { id: ctx.varId(name) }, PIN: pinNo, FREQ: Number(freq[2]) }), 2);
          }
        }
      }
      const kids = children(node);
      if (kids.length === 3 && kids[0].name === "VariableName" && ctx.src.slice(kids[1]) === "=") {
        return one(varSet(ctx.varId(ctx.src.slice(kids[0])), convertExpr(kids[2], ctx)));
      }
      return unknown(node, ctx);
    }

    case "ExpressionStatement": {
      const expr = node.firstChild;
      if (!expr || expr.name !== "CallExpression") return unknown(node, ctx);
      const { callee, args } = callParts(expr);
      const member = memberParts(callee, ctx);
      if (member) {
        const { obj, prop } = member;
        const argText = args.length === 1 ? ctx.src.slice(args[0]) : null;
        if (prop === "value" && ctx.pins.has(obj) && (argText === "0" || argText === "1")) return one(block("esp_pin_write", { VAR: { id: ctx.varId(obj) }, VALUE: argText }));
        if (prop === "duty_u16" && ctx.servos.has(obj) && (argText === "8100" || argText === "1638")) return one(block("esp_servo_door", { VAR: { id: ctx.varId(obj) }, ACTION: argText }));
        if (prop === "duty_u16" && (ctx.pwms.has(obj) || ctx.servos.has(obj)) && args.length === 1) return one(block("esp_pwm_duty", { VAR: { id: ctx.varId(obj) } }, { DUTY: convertExpr(args[0], ctx) }));
        if (obj === "time" && args.length === 1) {
          if (prop === "sleep") return one(block("flow_wait", undefined, { SEC: convertExpr(args[0], ctx) }));
          if (prop === "sleep_ms") return one(block("flow_wait_ms", undefined, { MS: convertExpr(args[0], ctx) }));
          if (prop === "sleep_us") return one(block("flow_wait_us", undefined, { US: convertExpr(args[0], ctx) }));
        }
        return unknown(node, ctx);
      }
      if (callee.name === "VariableName") {
        const name = ctx.src.slice(callee);
        if (name === "print" && args.length === 1) return one(block("esp_print", undefined, { VALUE: convertExpr(args[0], ctx) }));
        if (name === "print" && args.length === 2) return one(block("esp_print2", undefined, { A: convertExpr(args[0], ctx), B: convertExpr(args[1], ctx) }));
        if (name === "show" && ctx.oledFolded && args.length === 2) return one(block("esp_oled_show", undefined, { A: convertExpr(args[0], ctx), B: convertExpr(args[1], ctx) }));
        const fn = ctx.functions.get(name);
        if (fn && args.length === fn.params.length) return one(callBlock("procedures_callnoreturn", name, fn.params, args, ctx));
      }
      return unknown(node, ctx);
    }

    case "WhileStatement": {
      const cond = operands(node)[0];
      const body = children(node).find((k) => k.name === "Body") ?? null;
      if (!cond) return unknown(node, ctx);
      const DO = convertBody(body, ctx);
      if (cond.name === "Boolean" && ctx.src.slice(cond) === "True") return one(block("flow_repeat_forever", undefined, { DO }));
      const kids = children(cond);
      if (cond.name === "UnaryExpression" && ctx.src.slice(kids[0]) === "not" && kids[1]) return one(block("controls_whileUntil", { MODE: "UNTIL" }, { BOOL: convertExpr(kids[1], ctx), DO }));
      return one(block("controls_whileUntil", { MODE: "WHILE" }, { BOOL: convertExpr(cond, ctx), DO }));
    }

    case "ForStatement": {
      const ops = operands(node); // [VariableName, iterable]
      const iter = ops[1];
      const body = children(node).find((k) => k.name === "Body") ?? null;
      if (iter?.name === "CallExpression") {
        const { callee, args } = callParts(iter);
        if (ctx.src.slice(callee) === "range" && args.length === 1) return one(block("flow_repeat_n", undefined, { TIMES: convertExpr(args[0], ctx), DO: convertBody(body, ctx) }));
      }
      return unknown(node, ctx);
    }

    case "IfStatement": {
      const inputs: Record<string, BlockJson | undefined> = {};
      let elseIfCount = -1;
      let hasElse = false;
      let pendingCond: BlockJson | null = null;
      for (const k of children(node)) {
        if (k.name === "if" || k.name === "elif") { elseIfCount++; continue; }
        if (k.name === "else") { hasElse = true; continue; }
        if (k.name === "Body") {
          if (hasElse) inputs.ELSE = convertBody(k, ctx);
          else { inputs[`IF${elseIfCount}`] = pendingCond ?? undefined; inputs[`DO${elseIfCount}`] = convertBody(k, ctx); pendingCond = null; }
          continue;
        }
        if (k.name !== "Comment") pendingCond = convertExpr(k, ctx);
      }
      const extra = elseIfCount > 0 || hasElse ? { ...(elseIfCount > 0 ? { elseIfCount } : {}), ...(hasElse ? { hasElse } : {}) } : undefined;
      return one(block("controls_if", undefined, inputs, extra));
    }

    case "FunctionDefinition": {
      if (!topLevel) return unknown(node, ctx);
      const { name, params, body } = functionParts(node, ctx);
      if ((name === "get_distance" && ctx.ultrasonicFolded) || (name === "show" && ctx.oledFolded)) return none();
      const stmts = body ? bodyStatements(body) : [];
      const last = stmts[stmts.length - 1];
      let RETURN: BlockJson | undefined;
      let bodyStmts = stmts;
      if (last?.name === "ReturnStatement" && operands(last)[0]) { RETURN = convertExpr(operands(last)[0], ctx); bodyStmts = stmts.slice(0, -1); }
      const STACK = bodyStmts.every((s) => s.name === "PassStatement") ? undefined : chain(convertStatements(bodyStmts, ctx, false).blocks);
      const def = block(RETURN ? "procedures_defreturn" : "procedures_defnoreturn", { NAME: name }, { STACK, RETURN }, { params: params.map((p) => ({ name: p, id: ctx.varId(p) })) });
      withComment(def, inlineComment(node, ctx));
      return { blocks: [], tops: [def], consumed: 1 };
    }

    case "PassStatement":
      return one(codeStmt("pass"));

    default:
      return unknown(node, ctx);
  }
}
```

- [ ] **Step 9: 진입점 (사전 조사 → 변환 → JSON)**

`src/parser/index.ts`:
```ts
import { parser } from "@lezer/python";
import type { SyntaxNode } from "@lezer/common";
import { ParseContext } from "./context";
import { RE_I2C_SETUP, RE_OLED_SETUP, RE_PIN_SETUP, RE_PWM_SETUP, RE_FREQ, RE_DUTY, STANDARD_GET_DISTANCE, STANDARD_SHOW, functionParts, isStandardBody } from "./patterns";
import { convertStatements } from "./statements";
import { children } from "./tree";
import type { BlockJson, ParseResult, WorkspaceJson } from "./types";

export { normalizeCode } from "./normalize";
export type { BlockJson, ParseResult, UnparsedItem, WorkspaceJson } from "./types";

/** 대입·매개변수로 쓰인 이름을 모두 변수로 등록하고, 핀·PWM·함수 표와 접기 여부를 정한다 */
function survey(script: SyntaxNode, ctx: ParseContext): void {
  const walk = (node: SyntaxNode) => {
    if (node.name === "AssignStatement") {
      const kids = children(node);
      if (kids[0]?.name === "VariableName" && ctx.src.slice(kids[1]) === "=") ctx.varId(ctx.src.slice(kids[0]));
    }
    if (node.name === "FunctionDefinition") {
      const { name, params, body } = functionParts(node, ctx);
      params.forEach((p) => ctx.varId(p));
      const stmts = body ? children(body).filter((k) => k.name !== ":" && k.name !== "Comment") : [];
      ctx.functions.set(name, { params, returns: stmts[stmts.length - 1]?.name === "ReturnStatement" });
    }
    for (const c of children(node)) walk(c);
  };
  walk(script);

  const top = children(script);
  const texts = top.map((n) => ctx.src.slice(n).trim());
  let hasTrig = false, hasEcho = false, hasI2c = false, hasOled = false, stdDistance = false, stdShow = false;
  top.forEach((node, i) => {
    const pin = RE_PIN_SETUP.exec(texts[i]);
    if (pin) {
      ctx.pins.add(pin[1]);
      if (pin[1] === "trig" && pin[3] === "OUT") hasTrig = true;
      if (pin[1] === "echo" && pin[3] === "IN") { hasEcho = true; ctx.echoPin = Number(pin[2]); }
    }
    const pwm = RE_PWM_SETUP.exec(texts[i]);
    if (pwm) {
      const freq = RE_FREQ.exec(texts[i + 1] ?? "");
      const duty = RE_DUTY.exec(texts[i + 2] ?? "");
      if (freq?.[1] === pwm[1] && freq[2] === "50" && duty?.[1] === pwm[1] && duty[2] === "1638") ctx.servos.add(pwm[1]);
      else ctx.pwms.add(pwm[1]);
    }
    if (RE_I2C_SETUP.test(texts[i])) hasI2c = true;
    if (RE_OLED_SETUP.test(texts[i])) hasOled = true;
    if (node.name === "FunctionDefinition") {
      const { name, params, body } = functionParts(node, ctx);
      if (name === "get_distance" && params.length === 0 && body && isStandardBody(body, ctx, STANDARD_GET_DISTANCE)) stdDistance = true;
      if (name === "show" && params.join(",") === "a,b" && body && isStandardBody(body, ctx, STANDARD_SHOW)) stdShow = true;
    }
  });
  ctx.ultrasonicFolded = hasTrig && hasEcho && stdDistance;
  ctx.oledFolded = hasI2c && hasOled && stdShow;
  if (ctx.ultrasonicFolded) ctx.functions.delete("get_distance");
  if (ctx.oledFolded) ctx.functions.delete("show");
}

export function codeToBlocks(code: string): ParseResult {
  const tree = parser.parse(code);
  const ctx = new ParseContext(code);

  let errorAt = -1;
  tree.iterate({ enter(n) { if (errorAt < 0 && n.type.isError) { errorAt = n.from; } } });
  if (errorAt >= 0) return { ok: false, error: { line: ctx.src.lineOf(errorAt), message: "문법 오류가 있어요. 이 줄을 다시 읽어 보세요." } };

  const script = tree.topNode;
  survey(script, ctx);
  const { blocks, tops } = convertStatements(children(script), ctx, true);

  const start: BlockJson = { type: "start_program", x: 40, y: 40 };
  if (blocks.length) {
    for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
    start.inputs = { BODY: { block: blocks[0] } };
  }
  tops.forEach((t, i) => { t.x = 40; t.y = 40 + 400 * (i + 1); });

  const json = {
    variables: [...ctx.variables.entries()].map(([name, id]) => ({ name, id })),
    blocks: { languageVersion: 0, blocks: [...tops, start] },
  } as unknown as WorkspaceJson;
  return { ok: true, json, unparsed: ctx.unparsed };
}
```
주의: `survey`에서 함수 `returns`를 판단할 때 쓰는 "마지막 문장이 ReturnStatement"는 `statements.ts`의 `FunctionDefinition` 처리와 같은 기준이어야 한다. 함수 정의 블록 배열에서 `tops`가 `start`보다 앞에 오게 하는 것은 호출 블록이 정의를 찾을 수 있게 하기 위한 것이다.

- [ ] **Step 10: 파서 테스트 통과까지 고치기**

Run: `npm test -- src/parser/parser`
Expected: PASS. 흔한 실패 원인: (1) lezer 토큰 이름이 예상과 다를 때 — 실패한 입력을 `parser.parse(code)`로 돌려 `tree.iterate`로 노드 이름을 찍어 본다(사전 확인된 사실 절의 목록과 대조). (2) `IfStatement`에서 조건 노드가 `Comment`와 섞일 때 — `k.name !== "Comment"` 분기가 있다. (3) 문자열 디코딩 — `decodeString` 단위로 확인.

- [ ] **Step 11: 왕복 테스트**

`src/parser/roundtrip.test.ts`:
```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks, normalizeCode } from "./index";

const root = join(__dirname, "../../content/chapters");
const files = readdirSync(root).flatMap((dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith(".py")).map((f) => join(dir, f)));

describe("코드 → 블록 → 코드 왕복", () => {
  it("수업 파일이 14개 있다", () => expect(files).toHaveLength(14));

  for (const file of files) {
    it(file, () => {
      const src = readFileSync(join(root, file), "utf8");
      const r = codeToBlocks(src);
      expect(r.ok, "파싱 성공").toBe(true);
      if (!r.ok) return;
      const out = workspaceJsonToCode(r.json);
      expect(normalizeCode(out)).toEqual(normalizeCode(src));
      // step1_distance 는 두 줄짜리 get_distance 라서 time.ticks_* 식 3개가 코드 식으로 남는다
      const allowed = file.endsWith("step1_distance.py") ? 3 : 0;
      expect(r.unparsed.length, JSON.stringify(r.unparsed)).toBeLessThanOrEqual(allowed);
    });
  }
});
```

- [ ] **Step 12: 왕복 통과까지 고치기**

Run: `npm test -- src/parser/roundtrip`
Expected: 15 PASS. 실패하면 `normalizeCode(out)`와 `normalizeCode(src)`의 차이 줄을 출력해 어느 쪽(생성기 모양 vs 파서 인식)이 원인인지 가른다. 원문이 기준이다. 생성기를 고칠 때는 Task 3 테스트도 함께 통과해야 한다.

- [ ] **Step 13: 커밋**

Run: `npm test && npm run build`
```bash
git add src/parser content
git commit -m "MicroPython → 블록 파서와 수업 코드 14개 왕복 테스트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 자유 코딩 화면 (블록 ↔ 코드 실시간 동기화)

**Files:**
- Create: `src/app/lab/editorSync.ts`, `src/app/lab/sample.ts`, `src/components/editor/BlocklyWorkspace.tsx`, `src/components/editor/CodePanel.tsx`, `playwright.config.ts`, `e2e/lab.spec.ts`
- Modify: `src/app/lab/LabPage.tsx` (자리표시 교체)
- Test: `src/app/lab/editorSync.test.ts`

**Interfaces:**
- Consumes: `registerBlocks`, `entryTheme`, `toolbox`(Task 2), `generateCode(ws)`, `workspaceJsonToCode(json)`(Task 3), `codeToBlocks(code)`(Task 4).
- Produces:
  - `editorReducer(state: EditorState, action: EditorAction): EditorState`와 `initialEditorState(code: string): EditorState`
  - `BlocklyWorkspace` 컴포넌트: props `{ onChange(json, code): void; className? }`, ref 핸들 `{ load(json): void; getJson(): WorkspaceJson; getCode(): string }`
  - `CodePanel` 컴포넌트: props `{ value: string; readOnly: boolean; onChange(code): void; errorLine?: number | null; className? }`
  - 라우트 `#/lab`

- [ ] **Step 1: 동기화 리듀서 테스트**

`src/app/lab/editorSync.test.ts`:
```ts
import { describe, expect, it, beforeAll } from "vitest";
import { registerBlocks } from "@/blocks";
import { editorReducer, initialEditorState } from "./editorSync";

beforeAll(() => registerBlocks());

const LED = "from machine import Pin\n\nled = Pin(26, Pin.OUT)\n\nled.value(1)\n";

describe("editorReducer", () => {
  it("초기 상태는 코드에서 블록을 만든다", () => {
    const s = initialEditorState(LED);
    expect(s.source).toBe("blocks");
    expect(s.blocks).not.toBeNull();
    expect(s.code).toBe(LED);
    expect(s.parseError).toBeNull();
  });

  it("블록 모드에서 blocksChanged 는 코드를 갱신한다", () => {
    const s0 = initialEditorState(LED);
    const s1 = editorReducer(s0, { type: "blocksChanged", json: s0.blocks!, code: "print(1)\n" });
    expect(s1.code).toBe("print(1)\n");
  });

  it("코드 모드에서 codeChanged 는 블록을 다시 만들고, 문법 오류면 블록을 유지한다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "codeChanged", code: LED + "led.value(0)\n" });
    expect(s1.parseError).toBeNull();
    expect(JSON.stringify(s1.blocks)).toContain('"VALUE":"0"');
    const s2 = editorReducer(s1, { type: "codeChanged", code: "if x\n" });
    expect(s2.parseError?.line).toBe(1);
    expect(s2.blocks).toBe(s1.blocks);
    expect(s2.code).toBe("if x\n");
  });

  it("코드 모드에서 blocksChanged 는 무시한다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "blocksChanged", json: s0.blocks!, code: "zzz" });
    expect(s1).toBe(s0);
  });

  it("블록 모드로 돌아오면 코드를 블록 기준으로 다시 만든다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "codeChanged", code: "led = Pin(26, Pin.OUT)   # 주석\nled.value(1)\n" });
    const s2 = editorReducer(s1, { type: "switchSource", source: "blocks" });
    expect(s2.code).toBe("from machine import Pin\n\nled = Pin(26, Pin.OUT)  # 주석\n\nled.value(1)\n");
    expect(s2.parseError).toBeNull();
  });

  it("변환 안 된 조각 수를 센다", () => {
    const s0 = editorReducer(initialEditorState(LED), { type: "switchSource", source: "code" });
    const s1 = editorReducer(s0, { type: "codeChanged", code: "x = time.ticks_us()\n" });
    expect(s1.unparsed).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/lab`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 리듀서 구현**

`src/app/lab/editorSync.ts`:
```ts
import { workspaceJsonToCode, type WorkspaceJson } from "@/codegen";
import { codeToBlocks, type UnparsedItem } from "@/parser";

export type Source = "blocks" | "code";

export type EditorState = {
  /** 지금 기준이 되는 쪽. blocks 면 코드 패널은 읽기 전용 */
  source: Source;
  code: string;
  blocks: WorkspaceJson | null;
  unparsed: UnparsedItem[];
  parseError: { line: number; message: string } | null;
};

export type EditorAction =
  | { type: "blocksChanged"; json: WorkspaceJson; code: string }
  | { type: "codeChanged"; code: string }
  | { type: "switchSource"; source: Source }
  | { type: "loadCode"; code: string };

function fromCode(code: string, prev: EditorState): EditorState {
  const r = codeToBlocks(code);
  if (!r.ok) return { ...prev, code, parseError: r.error };
  return { ...prev, code, blocks: r.json, unparsed: r.unparsed, parseError: null };
}

export function initialEditorState(code: string): EditorState {
  const base: EditorState = { source: "blocks", code, blocks: null, unparsed: [], parseError: null };
  return fromCode(code, base);
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "blocksChanged":
      if (state.source !== "blocks") return state;
      return { ...state, blocks: action.json, code: action.code };
    case "codeChanged":
      if (state.source !== "code") return state;
      return fromCode(action.code, state);
    case "switchSource": {
      if (action.source === state.source) return state;
      if (action.source === "blocks") {
        const code = state.blocks ? workspaceJsonToCode(state.blocks) : state.code;
        return { ...state, source: "blocks", code, parseError: null };
      }
      return { ...state, source: "code" };
    }
    case "loadCode":
      return fromCode(action.code, { ...state, source: "blocks" });
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/app/lab`
Expected: PASS (6 tests)

- [ ] **Step 5: Blockly 컴포넌트**

`src/components/editor/BlocklyWorkspace.tsx`:
```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as Blockly from "blockly";
import { entryTheme, registerBlocks, toolbox } from "@/blocks";
import { generateCode, type WorkspaceJson } from "@/codegen";
import { cn } from "@/lib/utils";

export type BlocklyHandle = {
  load(json: WorkspaceJson): void;
  getJson(): WorkspaceJson;
  getCode(): string;
};

type Props = {
  /** 사용자가 블록을 바꿀 때마다 (프로그램이 load 한 경우는 제외) */
  onChange: (json: WorkspaceJson, code: string) => void;
  className?: string;
};

export const BlocklyWorkspace = forwardRef<BlocklyHandle, Props>(function BlocklyWorkspace({ onChange, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const loadingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    registerBlocks();
    const ws = Blockly.inject(host, {
      toolbox,
      theme: entryTheme,
      renderer: "zelos",
      trashcan: true,
      grid: { spacing: 24, length: 2, colour: "#e5e7eb", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.75, minScale: 0.4, maxScale: 1.5 },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    wsRef.current = ws;

    const listener = (e: Blockly.Events.Abstract) => {
      if (loadingRef.current || e.isUiEvent || ws.isDragging()) return;
      onChangeRef.current(Blockly.serialization.workspaces.save(ws) as WorkspaceJson, generateCode(ws));
    };
    ws.addChangeListener(listener);

    const observer = new ResizeObserver(() => Blockly.svgResize(ws));
    observer.observe(host);
    return () => {
      observer.disconnect();
      ws.removeChangeListener(listener);
      ws.dispose();
      wsRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    load(json) {
      const ws = wsRef.current;
      if (!ws) return;
      loadingRef.current = true;
      try {
        Blockly.Events.disable();
        ws.clear();
        Blockly.serialization.workspaces.load(json, ws);
      } finally {
        Blockly.Events.enable();
        loadingRef.current = false;
      }
    },
    getJson: () => Blockly.serialization.workspaces.save(wsRef.current!) as WorkspaceJson,
    getCode: () => (wsRef.current ? generateCode(wsRef.current) : ""),
  }));

  return <div ref={hostRef} className={cn("h-full w-full", className)} data-testid="blockly-host" />;
});
```

- [ ] **Step 6: CodeMirror 패널**

`src/components/editor/CodePanel.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { EditorState, Compartment, StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from "@codemirror/language";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  readOnly: boolean;
  onChange: (code: string) => void;
  /** 1-based. null 이면 강조 없음 */
  errorLine?: number | null;
  className?: string;
};

const setErrorLine = StateEffect.define<number | null>();
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setErrorLine)) continue;
      if (e.value == null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none;
      const line = tr.state.doc.line(e.value);
      deco = Decoration.set([Decoration.line({ class: "cm-error-line" }).range(line.from)]);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: "1.6" },
  ".cm-error-line": { backgroundColor: "rgba(239, 68, 68, 0.12)" },
  "&.cm-focused": { outline: "none" },
});

export function CodePanel({ value, readOnly, onChange, errorLine = null, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyComp = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const extensions: Extension[] = [
      lineNumbers(), highlightActiveLine(), history(), python(), indentUnit.of("    "),
      syntaxHighlighting(defaultHighlightStyle), keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      readOnlyComp.current.of(EditorState.readOnly.of(readOnly)),
      errorLineField, theme,
      EditorView.updateListener.of((u) => { if (u.docChanged) onChangeRef.current(u.state.doc.toString()); }),
    ];
    const view = new EditorView({ state: EditorState.create({ doc: value, extensions }), parent: host });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // value 는 아래 effect 가 따로 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: readOnlyComp.current.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine, value]);

  return <div ref={hostRef} className={cn("h-full w-full overflow-hidden", className)} data-testid="code-panel" />;
}
```

- [ ] **Step 7: 자유 코딩 화면**

`src/app/lab/sample.ts`:
```ts
/** 처음 열었을 때 깔려 있는 예시 (챕터 1 step4_blink_loop) */
export const SAMPLE_CODE = [
  "from machine import Pin",
  "import time",
  "",
  "led = Pin(26, Pin.OUT)",
  "",
  "while True:",
  "    led.value(1)",
  "    time.sleep(1)",
  "    led.value(0)",
  "    time.sleep(1)",
  "",
].join("\n");
```

`src/app/lab/LabPage.tsx`:
```tsx
import { useCallback, useEffect, useReducer, useRef } from "react";
import { AlertTriangle, Blocks, Code2, Play, Save, Square, Usb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BlocklyWorkspace, type BlocklyHandle } from "@/components/editor/BlocklyWorkspace";
import { CodePanel } from "@/components/editor/CodePanel";
import type { WorkspaceJson } from "@/codegen";
import { editorReducer, initialEditorState, type Source } from "./editorSync";
import { SAMPLE_CODE } from "./sample";

const DEVICE_BUTTONS = [
  { icon: Usb, label: "보드 연결" },
  { icon: Play, label: "실행" },
  { icon: Save, label: "보드에 저장" },
  { icon: Square, label: "멈춤" },
];

export function LabPage() {
  const [state, dispatch] = useReducer(editorReducer, SAMPLE_CODE, initialEditorState);
  const blocklyRef = useRef<BlocklyHandle>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  // 코드가 기준일 때: 파싱 결과가 바뀌면 작업판에 올린다
  useEffect(() => {
    if (state.source === "code" && state.blocks) blocklyRef.current?.load(state.blocks);
  }, [state.source, state.blocks]);

  // 처음 한 번: 예시 블록을 작업판에 올린다
  useEffect(() => {
    if (state.blocks) blocklyRef.current?.load(state.blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBlocksChange = useCallback((json: WorkspaceJson, code: string) => {
    dispatch({ type: "blocksChanged", json, code });
  }, []);

  const onCodeChange = useCallback((code: string) => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => dispatch({ type: "codeChanged", code }), 300);
  }, []);

  const switchSource = (source: Source) => {
    if (source === "blocks" && blocklyRef.current && state.blocks) {
      // 코드 모드에서 파싱 실패 상태로 돌아오면 마지막 성공 블록을 기준으로 삼는다
      blocklyRef.current.load(state.blocks);
    }
    dispatch({ type: "switchSource", source });
  };

  const codeMode = state.source === "code";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Tabs value={state.source} onValueChange={(v) => switchSource(v as Source)}>
          <TabsList>
            <TabsTrigger value="blocks"><Blocks className="size-4" />블록</TabsTrigger>
            <TabsTrigger value="code"><Code2 className="size-4" />코드</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-sm text-muted-foreground">
          {codeMode ? "코드를 고치면 블록이 따라옵니다" : "블록을 놓으면 코드가 바로 바뀝니다"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {DEVICE_BUTTONS.map(({ icon: Icon, label }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled><Icon className="size-4" />{label}</Button>
              </TooltipTrigger>
              <TooltipContent>보드 연결은 다음 단계에서 들어옵니다</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={62} minSize={35} className="relative">
          <BlocklyWorkspace ref={blocklyRef} onChange={onBlocksChange} />
          {codeMode && (
            <div className="pointer-events-auto absolute inset-0 flex items-start justify-center bg-background/40 pt-6" data-testid="blocks-overlay">
              <Badge variant="secondary">코드 편집 중 — 블록은 코드에 따라 갱신됩니다</Badge>
            </div>
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={38} minSize={25} className="flex flex-col">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-sm">
            <span className="font-medium">main.py</span>
            {state.unparsed.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1"><AlertTriangle className="size-3" />블록으로 바꾸지 못한 줄 {state.unparsed.length}개</Badge>
                </TooltipTrigger>
                <TooltipContent>{state.unparsed.map((u) => `${u.line}줄: ${u.text}`).join("\n")}</TooltipContent>
              </Tooltip>
            )}
            {state.parseError && (
              <Badge variant="destructive" className="gap-1" data-testid="parse-error">
                <AlertTriangle className="size-3" />{state.parseError.line}줄 {state.parseError.message}
              </Badge>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <CodePanel value={state.code} readOnly={!codeMode} onChange={onCodeChange} errorLine={state.parseError?.line ?? null} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
```
`TooltipProvider`가 필요하면 `App.tsx`에서 `<TooltipProvider>`로 감싼다(shadcn 버전에 따라 `Tooltip`이 자체 provider를 포함한다. `src/components/ui/tooltip.tsx`를 열어 확인).

- [ ] **Step 8: 빌드·타입 확인과 수동 확인**

Run: `npm run build && npm run dev`
Chrome에서 `http://localhost:5173/#/lab`를 열어 확인한다: 왼쪽에 엔트리 색 카테고리 8개, 작업판에 예시 블록, 오른쪽 코드가 `while True:` 포함. 블록 하나를 지우면 코드가 바뀐다. "코드" 탭에서 `led.value(0)` 줄을 추가하면 블록이 늘어난다. 문법을 틀리면 빨간 배지와 줄 강조가 보인다.

- [ ] **Step 9: Playwright 스모크**

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:5173", browserName: "chromium", viewport: { width: 1400, height: 900 } },
  webServer: { command: "npm run dev", url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
});
```

`e2e/lab.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("블록이 코드로, 코드가 블록으로 바뀐다", async ({ page }) => {
  await page.goto("/#/lab");
  await expect(page.getByTestId("blockly-host").locator(".blocklyWorkspace")).toBeVisible();
  const code = page.getByTestId("code-panel");
  await expect(code).toContainText("led = Pin(26, Pin.OUT)");
  await expect(code).toContainText("while True:");

  await page.getByRole("tab", { name: "코드" }).click();
  await expect(page.getByTestId("blocks-overlay")).toBeVisible();
  const editor = code.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nled.value(0)\n");
  await expect(page.getByTestId("parse-error")).toHaveCount(0);

  await page.getByRole("tab", { name: "블록" }).click();
  await expect(code).toContainText("led.value(0)");
});

test("문법 오류는 배지로 알려 준다", async ({ page }) => {
  await page.goto("/#/lab");
  await page.getByRole("tab", { name: "코드" }).click();
  const editor = page.getByTestId("code-panel").locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nif d < 15\n");
  await expect(page.getByTestId("parse-error")).toBeVisible();
});
```
Run: `npm run test:e2e`
Expected: 2 passed. 키 입력이 CodeMirror 자동 들여쓰기 때문에 꼬이면 `page.keyboard.type` 대신 `editor.fill(...)`로 전체 내용을 넣는다.

- [ ] **Step 10: 커밋과 푸시**

Run: `npm test && npm run build`
```bash
git add -A
git commit -m "자유 코딩 화면: 블록·코드 양방향 실시간 동기화, 코드 패널, 스모크 테스트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```
`gh run watch`로 배포가 끝나면 `https://sangwon7242.github.io/esp32-blocklab/#/lab`에서 같은 동작을 한 번 확인한다.

---

## 계획 1 완료 조건

- `npm test` 전부 통과(블록·생성기·파서·왕복 14개·동기화), `npm run test:e2e` 2개 통과, Pages에 배포된 주소에서 자유 코딩 화면이 동작.
- 다음 계획: **계획 2 — 보드 연결**(`src/device/`: Web Serial + raw REPL, 시리얼 모니터, 에러 줄 강조, FakeDevice), **계획 3 — 트랙·콘텐츠·저장·AI**. 두 계획은 계획 1이 끝난 뒤 실제 코드 구조를 보고 쓴다.
