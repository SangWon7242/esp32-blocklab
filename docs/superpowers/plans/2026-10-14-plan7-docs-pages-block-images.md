# ESP32 블록랩 — 계획 7: 블록 사전을 카테고리별 페이지로, 제목은 실제 블록 그림으로

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) 블록 사전(`#/docs`)에서 왼쪽 카테고리를 고르면 그 카테고리만 한 페이지로 보인다(긴 한 페이지 스크롤이 아니라). (2) 카드와 우클릭 팝업의 제목(글자 칩)을 편집기와 같은 렌더러(Zelos·entry 테마)로 그린 **실제 블록 그림(SVG)** 으로 바꿔 팔레트의 블록과 똑같이 보이게 한다. 팝업은 학생이 우클릭한 블록을 그 값 그대로 그린다.

**Architecture:** `src/docs/renderBlock.ts` 가 화면 밖에 숨긴 Blockly 작업판(`Blockly.inject`, zelos, `entryTheme`, 읽기 전용, 스크롤·줌 없음)을 하나 만들어 두고, 블록 JSON(툴박스 항목 그대로: 그림자 포함)을 넣어 렌더한 뒤 그 블록의 SVG 루트(`block.getSvgRoot()`)를 복제해 독립 `<svg>`(viewBox = 블록 크기, class 에 `blocklySvg zelos-renderer entry-theme` 등 주입 div 가 가진 클래스를 붙여 Blockly CSS 가 그대로 먹게)로 돌려준다. React 쪽 `BlockImage` 컴포넌트가 이를 `dangerouslySetInnerHTML` 없이 `ref` 로 붙인다(메모: 같은 JSON 은 한 번만 렌더). 블록 사전 화면은 `?cat=<카테고리 id>` 로 한 카테고리만 보여 주고, `?block=<type>` 은 그 블록의 카테고리를 열어 카드로 스크롤·강조한다. 검색어가 있으면 전체에서 찾아 카테고리별 묶음으로 보여 준다.

**Spec:** 이 문서 + `docs/superpowers/specs/2026-10-14-block-docs-design.md`.

## Global Constraints
- lucide·shadcn 만, 이모지 금지, 한국어. 기존 e2e(`e2e/docs.spec.ts`, `core-blocks.spec.ts`)는 새 구조에 맞게 고치되 검사하는 내용(검색·예시 열기·딥링크·팝업)은 유지.
- 블록 그림은 **편집기 팔레트와 같은 모양**이어야 한다: 같은 렌더러·테마·필드 기본값·그림자 블록. 값 블록은 둥근/육각 모양, 명령 블록은 위아래 홈이 보인다.
- 성능: 한 카테고리(최대 ~15 블록)만 그리므로 카드마다 그려도 된다. 숨긴 작업판은 모듈에 하나만 두고 페이지를 떠나도 재사용(또는 dispose 뒤 다음에 다시 만든다 — 메모리 누수 없이).
- 커밋마다 `npm test`·`npx tsc -b --noEmit`·`npm run build`, 마지막에 `npm run test:e2e`.

## 사전 확인된 사실
- 카탈로그 `src/docs/catalog.ts`: 툴박스 항목 → 헤드리스 작업판에 `Blockly.serialization.blocks.append(state(item), ws)` 로 블록을 만든다(`state()` 가 `{type, fields, inputs(shadow), extraState}` 를 만든다). `BlockDoc` 에 `title: TitlePart[]`, `variants`, `colour`. 같은 `state(item)` JSON 을 `BlockDoc.preset`(새 필드) 로 남기면 그림을 그릴 때 그대로 쓸 수 있다(변형도 `variantPresets`).
- 화면: `src/app/docs/DocsPage.tsx`(aside 카테고리 버튼 → `goToCategory` 가 섹션으로 스크롤; 검색 `searchDocs`; `?block=` 하이라이트), `src/app/docs/BlockDocCard.tsx`(`TitleChips`·`TitlePill`·`CategoryBadge`·`BlockDocBody`·`BlockDocCard`), 팝업 `src/components/editor/BlockDocDialog.tsx`(`TitlePill as="h2"` 로 제목; `request.title`·`request.blockId`·`fromFlyout`).
- 우클릭 요청 `BlockDocRequest`(`src/components/editor/blockDocMenu.ts`)는 `type`·`code`·`blockId`·`title`·`fromFlyout` 를 담는다. 학생 블록의 JSON 은 `Blockly.serialization.blocks.save(block)` 로 얻는다(그림자·값 포함; `addNextBlocks: false`).
- 주입 div 클래스: `Blockly.inject` 가 만드는 `.injectionDiv` 안 `<svg class="blocklySvg">`, 렌더러·테마 클래스(`zelos-renderer`, `entry-theme`)는 주입 div 에 붙는다 — 실제 DOM 에서 확인해 복제 svg 에 같은 클래스를 붙인다. Blockly CSS 는 문서에 한 번 주입된다(`Blockly.Css.inject`).
- 라우팅: HashRouter, `useSearchParams`. 네비 `블록 사전` 은 `/docs`(카테고리 없음 → 첫 카테고리 `시작`).

## Task 1: 블록 그림 렌더러 + 카드·팝업 적용
- [ ] `src/docs/catalog.ts`: `BlockDoc.preset: BlockState`(툴박스 항목 JSON), `variantPresets?: BlockState[]`.
- [ ] `src/docs/renderBlock.ts`: `renderBlockSvg(state: BlockState, scale = 0.8): SVGSVGElement`. 숨긴 작업판은 `position:fixed; left:-10000px; width/height 1px` div 에 `Blockly.inject(div, { renderer: "zelos", theme: entryTheme, readOnly: true, scrollbars: false, zoom: {startScale: 1}, toolbox: undefined })`. 블록을 만들고 `block.initSvg(); block.render()` 뒤 `getHeightWidth()` 로 크기를 재고 `getSvgRoot()` 를 `cloneNode(true)` 해 `<svg viewBox="0 0 w h" width=w*scale height=h*scale class="blocklySvg …">` 에 넣는다(`transform` 제거). 복제 뒤 원본 블록은 `dispose(false)`. 필드 드롭다운 화살표·그림자 값·글자가 그대로 보이는지 브라우저에서 확인(개발 서버 스크린샷). 글자가 안 보이면 Blockly CSS 선택자(`.blocklySvg .blocklyText` 등)에 맞게 래퍼 클래스를 조정한다.
- [ ] `src/app/docs/BlockImage.tsx`: `<BlockImage state scale alt />` — `useEffect` 로 svg 를 붙이고 언마운트 때 비운다; `role="img" aria-label={titleText}`.
- [ ] 카드(`BlockDocCard`): 제목 칩 대신 `BlockImage`(카테고리 배지는 유지), 변형은 "이런 이름으로도 나와요:" 아래 각 변형 그림. 팝업(`BlockDocDialog`): `request.state`(우클릭한 블록의 `serialization.blocks.save(block, {addNextBlocks:false})`)를 그린다 — `blockDocMenu.ts` 의 `BlockDocRequest` 에 `state` 추가. 글자 칩 컴포넌트(`TitleChips`/`TitlePill`)는 `aria`/검색용 텍스트에만 남기고 화면에서는 쓰지 않는다(남는 코드는 지운다).
- [ ] 테스트: `renderBlock` 은 DOM 이 필요하므로 단위 테스트는 `BlockDoc.preset` 존재·`state()` 동일성만; e2e `docs.spec.ts` 에 "카드에 `svg.blocklySvg` 가 있고 그 안에 `.blocklyText` 로 블록 문구('초 기다리기')가 있다", 팝업에도 svg 가 있다.
- [ ] 커밋 "블록 사전: 제목을 실제 블록 그림(SVG)으로".

## Task 2: 카테고리별 페이지
- [ ] `DocsPage`: `?cat=<id>`(없으면 첫 카테고리). aside/칩의 버튼은 `setSearchParams({cat})`(replace 아님 — 뒤로 가기로 카테고리 이동 가능). 본문은 그 카테고리 제목 + 카드들. 검색어가 있으면 `?cat` 을 무시하고 전체 결과를 카테고리별 묶음으로(지금처럼), 검색어를 지우면 다시 그 카테고리. `?block=<type>` 이 오면 그 블록의 카테고리를 `cat` 으로 삼고 카드로 스크롤·2초 강조(기존 동작 유지).
- [ ] 선택된 카테고리 버튼은 그 색으로 채움(편집기 타일과 같은 규칙, `textColourOn`). 카테고리 개수 표시 유지.
- [ ] e2e 갱신: 검색→예시 열기(그대로), `?block=flow_wait` → 흐름 카테고리가 열리고 카드가 보임, 카테고리 버튼 클릭 → 그 카테고리 카드만 보이고 주소에 `cat=`.
- [ ] 커밋 "블록 사전: 카테고리마다 한 페이지", 푸시, 배포 확인.
