# ESP32 블록랩 — 블록 설명(블록 사전) 설계

작성 2026-10-14 오전. 요청: "학생들이 블록코드를 해도 해당 코드가 어떤 코드인지 모를 수 있기에, 블록마다 마우스 우클릭하면 해당 코드에 대한 내용을 팝업으로 한눈에 보게 하고, 별도의 코드 설명 docs 페이지에서 각 블록의 개념과 코드 예시를 볼 수 있게". 선생님이 외근 중이라 추천 방향(둘 다)으로 자체 승인해 진행한다.

## 1. 목표

- 작업판·팔레트의 어떤 블록이든 **우클릭 → "이 블록 설명 보기"** 로 그 블록이 만드는 MicroPython 코드(지금 값 그대로), 개념 설명, 예시 프로그램을 팝업(shadcn Dialog)으로 본다.
- 상단 메뉴 **"블록 사전"**(`#/docs`)에서 모든 블록을 카테고리별로 훑어보고, 검색하고, 예시를 자유 코딩 편집기에 바로 열어 본다.
- 설명 글은 학생 눈높이의 한국어, 코드는 영어 그대로. 이모지 없음, lucide 아이콘·shadcn만.

## 2. 데이터: `src/docs/`

- `types.ts` — `BlockDoc = { type; category: { name; colour }; title: TitlePart[]; code: string; concept: string; example: { title: string; code: string }; tips?: string[] }`. `TitlePart = { kind: "text"; text } | { kind: "slot"; text }`(슬롯은 필드 기본값·값 칸 그림자 값을 칩으로 그린다).
- `catalog.ts` — 툴박스(`src/blocks/toolbox.ts`) + 변수·함수 내장 블록 목록을 돌며 블록 종류마다 `BlockDoc` 을 만든다. 제목은 블록 정의의 `message0` 에서 `%n` 을 해당 인자의 기본값(필드 기본값, 값 칸은 툴박스 그림자 값)으로 바꿔 만든다. `code` 는 **헤드리스 작업판**(`new Blockly.Workspace()`)에 툴박스 항목 그대로 블록 하나를 만들어 생성기(`src/codegen`)로 뽑은 그 블록만의 코드이다(준비 줄 끌어올리기·도우미 함수는 그 블록 코드 안에서 보이는 그대로). 같은 블록 종류가 툴박스에 여러 번 나오면(조건 블록의 아니면 꼴, 조도 센서 밑의 읽기 블록) 첫 항목을 대표로 쓰고 나머지는 `variants` 로 둔다(제목만 다름).
- `content/` — 블록 종류별 손으로 쓴 `concept`·`example`·`tips`. `content/index.ts` 가 `Record<blockType, BlockContent>` 로 합친다. 예시는 **코드로** 쓴다(작성이 쉽고 정확). 예시는 블록으로 되돌릴 수 있어야 한다: 테스트가 `codeToBlocks(example.code)` 결과에 `code_stmt`/`code_expr` 대체 블록이 없는지 확인한다.
- `catalog.test.ts` — 툴박스의 모든 블록 종류 + 변수·함수 내장 블록에 content 가 있고, 제목에 `%` 가 남지 않고, 코드가 비지 않고, 예시가 블록으로 되돌아간다.
- 카탈로그는 처음 쓸 때 한 번 만들어 메모(`getCatalog()`), 검색은 제목 글·코드·개념에 대한 단순 포함 검색.

## 3. 팝업: 우클릭 메뉴

- `src/components/editor/blockDocMenu.ts` — `Blockly.ContextMenuRegistry` 에 `block_doc` 항목(블록 범위, 문구 "이 블록 설명 보기", weight 0 으로 맨 위)을 **한 번만** 등록. 팔레트(flyout) 블록에서도 열린다. 콜백은 등록 시 받은 `onOpen(type, codeOfThisBlock)` 을 부른다. `codeOfThisBlock` 은 우클릭한 블록을 생성기로 돌린 코드(학생이 적은 값 그대로; 값 블록이면 식, 명령이면 줄들).
- `BlocklyWorkspace` 에 `onDocRequest?: (type: string, code: string) => void` prop 추가. `EditorWorkbench` 가 받아 `BlockDocDialog` 를 연다.
- `src/components/editor/BlockDocDialog.tsx` — shadcn Dialog. 내용: 카테고리 배지 + 제목 칩, "내 블록이 만드는 코드"(우클릭한 블록의 코드, `<pre>`), "무슨 뜻인가요"(concept), "예시 프로그램"(example.code), tips 목록. 버튼: "블록 사전에서 보기"(`#/docs?block=<type>`, 새 탭으로 연다: 같은 창 이동은 작업판을 잃고 보드 연결이 끊긴다. 설명이 있는 블록에만), 자유 코딩 화면일 때만 "예시를 편집기에 열기"(AlertDialog 로 "지금 작업판을 예시로 바꿀까요?" 확인 뒤 `loadCode(example.code)`).
- 모바일 폭에서는 Dialog 가 거의 전체 화면.

## 4. 블록 사전 화면 `#/docs`

- 상단 메뉴에 "블록 사전"(`BookOpen`) 추가(자유 코딩·트랙·블록 사전·설정 순).
- 왼쪽: 카테고리 목록(툴박스 순서, 카테고리 색 점). 위: 검색 Input(제목·코드·개념 포함 검색, 결과 수 표시). 본문: 카테고리별 섹션, 블록마다 Card(제목 칩 + 카테고리 배지, 코드, 개념, 예시 접기/펼치기, tips) 와 "편집기에서 열어 보기" 버튼(`#/lab?example=<type>`).
- `#/docs?block=<type>` 로 들어오면 그 카드로 스크롤하고 잠시 강조한다.
- `LabPage` 는 `?example=<type>` 이 있으면 그 블록의 예시 코드를 초기 코드로 싣는다(`?code=` 와 같은 자리).

## 5. 범위 밖

- 블록 그림(SVG) 렌더링: 제목 칩으로 대신한다(가볍고 깨지지 않음). 필요하면 뒤에 붙인다.
- 영어 설명, 트랙 단계와의 연결, 교사용 편집 UI.

## 6. 테스트

- 단위: catalog.test.ts(위), blockDocMenu(등록 1회·콜백 호출), 검색 함수.
- e2e: (1) 자유 코딩에서 작업판 블록 우클릭 → 메뉴 "이 블록 설명 보기" → Dialog 에 코드가 보인다. (2) `#/docs` 에서 검색 "깜빡" → 카드 1개 이상, "편집기에서 열어 보기" → `#/lab?example=…` 로 이동해 코드 패널에 예시 코드가 있다.
