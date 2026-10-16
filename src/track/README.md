# 트랙 콘텐츠 형식 (chapter.yaml)

챕터 하나는 폴더 하나다: `content/chapters/<id>/chapter.yaml` + 같은 폴더의 `.py` 파일들 + `images/*.svg` 그림.
`npm test`가 모든 YAML을 `src/track/schema.ts`(zod)로 검사한다. 키 오타, 없는 파일, 겹치는 id, 틀린 정규식,
범위 밖 답은 테스트에서 걸린다.

코드를 가리키는 키(`code`, `targetCode`, `lineExplain`, `answerCode`, `codeEquals.file`)는 **같은 폴더의 파일 이름**만 쓴다
(`code: step1_distance.py`). 예외: `debug`의 증상 `code`는 파일 이름이 아니라 **고장 난 코드 조각 그대로**다.

그림을 가리키는 키(`cover`, `materials[].image`, `wiring.image`, `principle.image`, `scene.image`)는 **챕터 폴더 기준 `images/<이름>.svg`** 만 쓴다
(`image: images/wiring-led.svg`, 영문·숫자·`_`·`.`·`-` 이름). 없는 그림, 다른 모양(`.png`, 하위 폴더, `../`)은 테스트에서 걸린다.

## 챕터

```yaml
id: 10-auto-door          # 폴더 이름과 같아야 함
order: 10                 # 목록 순서 (트랙 탭 안에서도 이 순서)
track: fusion             # 필수. sensor(센서 트랙) | fusion(교과 융합 트랙) — 아래 "트랙 메타"
label: F3                 # 필수. 화면 번호 (센서 S1·S2…, 교과 융합 F1·F2…)
prerequisites: [17-ultrasonic, 18-servo, 21-oled]   # 선택. 먼저 할 챕터 id (안내만, 잠그지 않음)
subjects: [과학, 수학]     # 선택. 연결 교과
sdg: [11]                 # 선택. SDG 번호 1~17
sessions: 2               # 선택. 차시 수
status: published         # 선택. draft | published (기본 published)
teacherNotes: |           # 선택. 교사 메모 (markdown, 교사 모드에서만)
  ...
title: 다가가면 열리는 자동문
subtitle: ...             # 선택
summary: ...              # 선택. 챕터 화면·목록 카드의 한두 문장 소개 (markdown)
cover: images/cover.svg   # 선택. 표지 그림
materials:                # 선택. 준비물(부품) 칩
  - { name: ESP32 보드, image: images/part-esp32.svg }
  - { name: 220Ω 저항, note: 빨강-빨강-갈색 }      # image·note 는 선택
wiring: { image: images/wiring-led.svg, caption: "LED 긴 다리 → 저항 → 26번" }   # 선택. 배선도
principle:                # 선택. 원리 카드 (아래 "Keyestudio 수업 구조")
  image: images/led-parts.svg   # 선택. 카드 왼쪽 그림
  body: |                 # markdown
    핀이 **HIGH**(3.3V)이면 전기가 흘러 불이 켜져요
goals: { content: ..., thinking: ... }   # 선택
successCriteria: [...]    # 선택
parts:
  - id: part1
    title: 1부 · 초음파 센서 익히기
    steps: [ ... ]
```

## 트랙 메타 (센서 트랙 / 교과 융합 트랙)

트랙 화면(`#/track`)은 두 탭이다: **센서 트랙**(모듈 하나, 개념 하나)과 **교과 융합 트랙**(센서 여러 개를 묶어 교과·SDG 문제 풀기).
주소 `#/track?track=sensor|fusion` 으로 탭을 고르고, 주소에 없으면 이 브라우저에서 마지막으로 본 탭(처음엔 센서 트랙).
챕터 화면의 "챕터 목록"은 그 챕터의 탭으로 돌아간다. 화면용 순수 함수는 `src/track/tracks.ts`.

| 키 | 필수 | 뜻 · 화면 |
|---|---|---|
| `track` | 예 | `sensor` \| `fusion`. 어느 탭에 보일지. 탭 안 순서는 `order` |
| `label` | 예 | 화면 번호. 영어 대문자 하나 + 숫자(`S8`, `F3`). 센서는 `S`, 교과 융합은 `F` 로 시작(테스트가 검사), 모든 챕터에서 겹치지 않게 |
| `prerequisites` | | 먼저 할 챕터 id 목록. **안내만** 하고 잠그지 않는다(관문은 챕터 안에서만). 카드·챕터 화면에 링크 + 완료 표시(그 챕터의 필수 단계 — `optional` 아닌 단계 — 를 모두 끝내면 완료). 아직 폴더가 없는 id 도 쓸 수 있다: 링크 없이 "준비 중"(계획 표 `PLANNED_CHAPTERS` 에 있으면 번호·제목도). 모양은 `번호-영어`(`18-servo`), 자기 자신·중복은 검사에서 걸린다 |
| `subjects` | | 연결 교과 칩(`[과학, 수학]`). 교과 융합 챕터에 쓴다 |
| `sdg` | | 유엔 지속가능발전목표 번호 1~17 칩(`SDG 11`) |
| `sessions` | | 차시 수(`2차시`). 1차시 = 45분 기준으로 단계 `minutes` 합을 올림해 정한다(분이 없으면 1) |
| `status` | | `draft` 면 목록에서 **교사 모드에서만** "초안" 배지와 함께 보인다. 주소(`#/track/<id>`)로는 누구나 열리고 평소처럼 동작한다. 기본 `published` |
| `teacherNotes` | | 교사 메모(안내 글 markdown). **교사 모드에서만** 챕터 화면 맨 아래 "교사 메모" 카드로 보인다 |

새 챕터를 쓸 때: 폴더 이름 = id(`11-button-touch`), `track`·`label` 을 꼭 넣고, 다 쓰기 전에는 `status: draft` 로 두었다가 마치면 지운다(또는 `published`).
교과 융합 챕터는 `prerequisites`·`subjects`·(있으면)`sdg`·`sessions` 을 채운다. 먼저 할 챕터가 아직 없어도 id 로 미리 적어 둔다.

```yaml
id: 32-smart-cane
order: 32
track: fusion
label: F5
prerequisites: [12-melody-buzzer, 14-light-sensor, 16-tilt-pir, 17-ultrasonic]
subjects: [과학, 수학, 사회]
sdg: [10]
sessions: 3
status: draft
teacherNotes: |
  **준비** 초음파 센서는 지팡이 끝에서 30° 아래를 보게 붙인다.

  - 2차시: 소리 크기 ↔ 거리 비례를 수학 시간과 연결
title: 스마트 지팡이
```

## Keyestudio 수업 구조 (원리 · 실행 결과 · 코드 설명)

Keyestudio 수업의 "2. 원리", "6. 실행 결과", "7. 코드 설명"을 담는 키. 모두 선택이다.

| 키 | 어디에 | 화면 |
|---|---|---|
| `principle: { body, image? }` | 챕터 | 챕터 화면 hero(진행·소개) 밑 **원리** 카드. 기본 펼침(접을 수 있음). `image` 가 있으면 넓은 화면에서 그림이 글 왼쪽(좁으면 위), 눌러서 크게 보기. `body` 는 안내 글 markdown |
| `expected` | `run` 단계 | 안내 칸 "지금 할 일" 다음의 **이렇게 되면 성공** 카드. "코드를 실행하면 … 보여요" 처럼 눈에 보이는 결과를 쓴다 (markdown) |
| `codeNotes: [{ line, note }]` | `run`·`readcheck` 단계 | 접힌 **코드 설명** 칸: 줄 번호 배지 + 설명 목록. 설명을 누르면 읽기 전용 코드에서 그 줄을 강조(파란 띠)하고 그 줄까지 스크롤, 다시 누르면 해제 |

- `codeNotes[].line` 은 그 단계 `code` 파일 **원문**의 줄 번호(1부터, 빈 줄·주석 포함 — 읽기 체크 `line` 답과 같은 기준). 파일 줄 수를 넘으면 검사에서 걸리고, 빈 줄을 가리켜도 content 테스트가 잡는다. `note` 는 한 줄 markdown(`**굵게**`·`` `코드` ``만).
- `run` 의 코드 설명 칸은 활동 칸 편집기 위에 있고, 칸을 펼치면 **원본 파일**(`code`)을 읽기 전용으로 함께 보여 준다(학생이 편집기에서 코드를 고쳐도 줄 번호가 어긋나지 않게).
- `readcheck` 의 코드 설명 칸은 문항 위에 접혀 있다(문항의 답을 먼저 드러내지 않게). 이미 있는 읽기 전용 코드에서 줄을 강조한다.
- `principle.image` 는 다른 그림 키와 같은 규칙(`images/<이름>.svg`, 폴더에 있어야 함).

```yaml
- id: run
  type: run
  title: 복사 · 실행
  code: step1_led_on.py
  expected: 코드를 실행하면 26번 핀에 꽂은 LED에 불이 들어와요.
  codeNotes:
    - { line: 3, note: "26번 핀을 내보내는(출력) 핀으로 정하고 이름을 `led`로 붙여요" }
    - { line: 5, note: "`led`에 1(HIGH)을 보내 LED를 켜요" }
```

## 단계 (공통 키)

| 키 | 뜻 |
|---|---|
| `id` | 챕터 안에서 겹치지 않는 영어 소문자·숫자·`-` (진행 기록의 키가 되므로 바꾸지 말 것) |
| `type` | 아래 유형 (`problem`·`analysis`·`predict`·`run`·`readcheck`·`mission`·`debug`·`design`·`reflect`·`app`) |
| `title` | 단계 제목 |
| `minutes` | 선택. 기준 시간(분) |
| `scene` | 선택. `{ image, caption? }` — 안내 칸 맨 위 장면 그림과 그 아래 설명 |
| `body` | 선택. 왼쪽 안내 칸 글 (아래 "안내 글 markdown"). 없으면 유형별 기본 안내 |
| `todo` | 선택. "지금 할 일" 1~4개 (markdown 한 줄씩). 체크 표시는 장식이고 완료 조건은 유형별 규칙 그대로 |
| `optional` | 선택. `true`면 건너뛸 수 있고, 마치지 않아도 다음 단계가 열린다 |

안내 칸 순서: 단계 배지·제목 → `scene` 그림 → `body` → "지금 할 일"(`todo`) → "이렇게 되면 성공"(`run` 의 `expected`) → 접힘 "부품과 배선"(챕터 `materials`·`wiring`) → 시간·완료.
안내 칸의 그림은 눌러서 크게 볼 수 있다(좁은 칸에서는 그림 속 글자가 작아지므로 핵심은 `caption`·`body` 에도 글로 쓴다).
`analysis` 단계는 챕터 폴더의 `images/three-boxes.svg` 가 있으면 활동 칸의 세 입력 칸 위에 그린다. `scene` 이 그 그림이면 안내 칸에서는 빼고 활동 칸에만 (설명은 `scene.caption`).
넓은 화면에서는 안내 칸을 접어 활동을 전폭으로 쓸 수 있다(이 브라우저에 기억).

### 안내 글 markdown

`body`·`todo`·`summary`·`principle.body`·`expected`·`teacherNotes` 는 라이브러리 없는 가벼운 markdown(`src/app/track/guideMarkdown.ts`)으로 그린다.

- 빈 줄 = 문단 나눔. 문단 안 줄바꿈은 그대로 보인다
- `- 항목` (또는 `* 항목`) = 글머리 목록, `1. 항목` = 번호 목록. 들여 쓴 다음 줄은 앞 항목에 이어 붙는다
- `**굵게**`, `` `코드` `` (코드 안의 `**` 는 그대로). 제목(`#`)·링크·그림 문법은 없다

YAML 에서 여러 줄 글은 `|` 블록으로 쓴다:

```yaml
body: |
  LED 는 **긴 다리**가 + 예요.

  - 긴 다리 → 저항 → `26`번 핀
  - 짧은 다리 → GND
todo: [보드를 USB 로 연결하기, "`26`번 핀에 LED 꽂기"]
```

### 그림 (SVG)

- 파일: `content/chapters/<id>/images/<이름>.svg`. 빌드 때 `src/track/images.ts` 가 `import.meta.glob(..., { query: "?raw" })` 로 원문을 묶고, 화면(`src/app/track/Illustration.tsx`)이 **인라인 SVG** 로 그린다.
- `viewBox` 만 두고 `width`/`height` 는 빼도 된다(화면이 폭에 맞추고 높이는 비율대로). 장면 `0 0 640 360`, 부품은 정사각.
- 선은 `stroke="currentColor"`(글자색을 따라 다크 모드 대응), 면 색은 `var(--primary)`·`var(--muted)` 같은 CSS 변수나 카테고리 색 소수만.
- `<svg role="img">` + 첫 자식 `<title>설명</title>`. 글자는 `<text>` 에 한국어, `font-family="inherit"`.
- `<script>`, `on*=` 처리기, `javascript:` 주소 금지(테스트가 검사하고, 화면도 한 번 더 거른다).
- 한 화면에 여러 그림이 같이 그려지므로 `id`(그라데이션·`marker` 등)는 파일마다 겹치지 않게 접두어를 붙인다(`led-arrow`).

## 유형별 키

| type | 키 |
|---|---|
| `problem` | `questions`: 열린 질문 1~3개 |
| `analysis` | `answer: { know: [...], decide: [...], act: [...] }` — 예시 답 (세 칸을 다 쓴 뒤에만 공개) |
| `predict` | `code`, `blanks: [{ q, unit? }]` — 빈칸 하나에 질문 하나 |
| `run` | `code`, `expected?`(실행 결과), `codeNotes?`(코드 설명) |
| `readcheck` | `code`, `questions: [...]` (아래), `codeNotes?`(코드 설명) |
| `mission` | `instructions`, `code?`(미리 깔 코드), `hint?`, `rules`(1개 이상), `answerCode?`, `startPasses?`(아래 "규칙 유지 장치") |
| `debug` | `symptoms: [{ title, code(코드 조각), question, rules? }]`, `rules?`(전체 규칙), `answerCode?` |
| `design` | `pseudocode: [{ text, blank?: { answer, tolerance? } }]`, `translation: [[우리말, 코드], ...]`, `targetCode` |
| `reflect` | `lineExplain`(줄마다 "이 줄은 ___" 을 쓸 코드), `prompts`: 정확히 4개 |
| `app` | `api`(약속표), `design: { show, buttons, changes }`(설계 칸 보기 글), `promptTemplate`, `checks?: { maxBytes?, mustUse? }`, `readcheck`(1~3문항) — 아래 "앱 만들기" |

- `design.pseudocode`: `text`의 `__` 자리가 빈칸이고 `blank.answer`가 예시 답이다(글 또는 숫자). 빈칸 없는 줄은 `blank`를 빼면 된다.
  채점(`src/track/design.ts`): 숫자이거나 숫자로 시작하는 답(`15 cm`)은 학생 글의 첫 숫자를 `tolerance`(기본 0) 범위로, 글 답은 공백을 무시하고 비교한다. `문(서보)`처럼 괄호가 있으면 `문`, `서보`도 맞다.
  조립 작업판은 `targetCode`를 블록으로 바꾼 뒤 시작 블록 몸통의 명령 블록을 하나씩 떼어(안쪽 몸통은 그대로) 섞어 둔다. 판정은 `codeEquals targetCode`.
- `debug.symptoms[].rules`: 그 증상의 고장 코드를 고친 결과에 거는 규칙.

### 앱 만들기 (`app`)

AI 바이브 코딩으로 폰 앱(웹 페이지 한 장)을 만드는 단계. 활동 칸은 위에서부터 차례로:
① **화면 설계** 세 칸(보여 줄 값·누를 버튼·바뀌는 모습, 학생이 한 줄에 하나씩) → ② **약속표**(`api`) →
③ **프롬프트**(템플릿을 설계·약속표로 채운 글 + 복사) → ④ **결과 붙여넣기 · 검사** → ⑤ 통과하면 **보드에 `index.html` 저장**(보드 연결 필요, 선택)·**미리 보기**(`sandbox` iframe — 스크립트·요청 없이 모양만) → ⑥ **읽기 체크**.
완료 조건: 검사 통과 + 읽기 체크 통과. 보드 저장은 하지 않아도 완료할 수 있다(보드가 없는 교실). 검사 뒤 붙여 둔 글을 고치면 다시 검사해야 한다.

```yaml
- type: app
  id: app
  title: 폰 앱 만들기
  minutes: 20
  api:                         # 약속표: ESP32 코드가 내는 주소 (코드와 맞춰 적는다)
    - { path: "/data", method: "읽기", fields: ["temp", "hum"], note: "2초마다 읽기" }
    - { path: "/cmd?led=on", method: "명령", note: "LED 켜기" }
    - { path: "/cmd?led=off", method: "명령", note: "LED 끄기" }
  design:                      # 설계 칸의 보기 글 (학생 칸에 "예:" 로 흐리게만 보인다). 칸마다 생략하면 []
    show: ["온도", "습도"]
    buttons: ["LED 켜기", "LED 끄기"]
    changes: ["온도 28 넘으면 빨강"]
  promptTemplate: |
    ESP32 주소 {{ip}} 에서 {{data}} 를 2초마다 읽어 {{show}} 을(를) 보여 주고,
    버튼 {{buttons}} 을(를) 누르면 {{commands}} 를 요청하는 한 파일짜리 HTML 을 만들어 줘.
    외부 라이브러리·외부 스크립트 없이, 폰 화면에 맞게.
  checks:                      # 선택. 기본: maxBytes 12000, mustUse = 약속표 주소의 경로(/data, /cmd)
    maxBytes: 12000
    mustUse: ["led=on"]        # 기본에 덧붙는다
  readcheck:                   # 1~3문항
    - { kind: choice, q: "값을 가져오는 줄에 쓰인 것은?", options: ["fetch", "print", "import"], answer: 0, hint: "주소에 요청을 보내는 함수" }
    - { kind: text, q: "버튼을 누르면 어느 줄이 보드에 요청을 보내나요?" }
```

| 키 | 뜻 |
|---|---|
| `api[].path` | `/` 로 시작하는 상대 주소(빈칸 없이). 질의(`?led=on`)를 붙여도 된다 |
| `api[].method` | `읽기`(값 JSON 을 주는 주소) \| `명령`(보드에 일을 시키는 주소) |
| `api[].fields` | 선택. 읽기 주소가 주는 JSON 키 |
| `api[].note` | 선택. 설명 (명령 주소의 설명은 프롬프트에도 들어간다) |
| `design` | 세 칸의 보기 글. 학생 답이 아니라 흐린 예시로만 보인다 |
| `promptTemplate` | 빈칸 `{{ip}}`·`{{data}}`·`{{commands}}`·`{{show}}`·`{{buttons}}`·`{{changes}}` 만 쓸 수 있다(다른 이름은 검사에서 걸린다) |
| `checks.maxBytes` | 선택. 크기 한도(UTF-8 바이트, 기본 12000) |
| `checks.mustUse` | 선택. 코드에 꼭 있어야 할 글. 약속표 주소의 경로(`?` 앞)는 늘 기본으로 들어간다 |
| `readcheck` | 결과 HTML 읽기 체크 1~3문항. `choice` 는 채점(`answer` = 선택지 번호), `text` 는 학생 코드마다 답이 달라 채점하지 않고 쓰기만 하면 통과(교사가 확인) |

프롬프트 빈칸이 채워지는 글 (`src/track/appCheck.ts` `fillPrompt`):

| 빈칸 | 채우는 글 |
|---|---|
| `{{ip}}` | `이 페이지를 내준 보드(상대 주소)` — 앱은 보드가 내주므로 늘 상대 주소로 묻는다. "ESP32 주소 {{ip}} 에서" 처럼 쓴다 |
| `{{data}}` | 읽기 주소들: `/data(JSON: temp, hum)` |
| `{{commands}}` | 명령 주소들: `/cmd?led=on(LED 켜기), /cmd?led=off(LED 끄기)` |
| `{{show}}`·`{{buttons}}`·`{{changes}}` | 학생 설계 칸의 줄을 `, ` 로 이은 것. 템플릿이 쓰는 칸이 비어 있으면 `___` 로 남고 복사 버튼이 꺼진다 |

붙여넣기 검사 (`checkAppHtml`, 실패마다 되묻기 한 줄). AI 답을 ```` ``` ```` 울타리째 붙여도 울타리는 걷고 검사한다:

| 항목 | 통과 조건 |
|---|---|
| 한 파일짜리 HTML | `<html` 이 있다 |
| 다른 파일의 스크립트를 불러오지 않기 | `<script src=…>` 가 없다 (상대 주소여도 — 보드에는 `index.html` 하나뿐) |
| 바깥 스타일·글꼴을 불러오지 않기 | `<link href="http…">`·`<link href="//…">` 가 없다 |
| ESP32 상대 주소만 쓰기 | `http://`·`https://` 주소, `src=`/`href=` 의 `//…` 가 없다 (보드 IP 를 박은 주소도 실패). `http://www.w3.org/…`(SVG `xmlns`)는 예외 |
| 약속 주소 쓰기 | `mustUse` 글이 모두 있다 (항목마다 따로) |
| 크기 | UTF-8 바이트 ≤ `maxBytes` |
| `<iframe` 쓰지 않기 / `eval(` 쓰지 않기 | 없다 |

슬라이드(`npm run slides`)의 app 단계 장: 화면 설계 세 칸(빈 칸) · 약속표 · 프롬프트 템플릿(빈칸은 `＿＿(보여 줄 값)` 꼴) · 붙여넣기 검사 항목 · 읽기 체크 문항(답·힌트 없이).

### 읽기 체크 문항

```yaml
- { kind: number, q: "문이 열려 있는 시간은 몇 초?", answer: 3 }
- { kind: choice, q: "소리를 쏘는 핀은?", options: ["trig", "echo"], answer: 0, hint: "trig 는 trigger(방아쇠)" }
- { kind: line,   q: "1초 기다리는 첫 줄을 클릭", answer: 8 }
```

`choice`의 `answer`는 선택지 번호(0부터), `line`의 `answer`는 코드 파일 **원문**의 줄 번호(1부터, 빈 줄·주석 포함). `hint`는 선택.

## 판정 규칙 (`rules`)

규칙마다 `fail`(실패 때 보여 줄 문장 — 정답을 말하지 않는 되묻기)을 반드시 쓴다.

| 규칙 | 통과 조건 |
|---|---|
| `useBlock: [type, ...]` | 블록 중 하나 이상이 작업판에 있다 (그림자 블록 제외, 입력·다음 블록 재귀) |
| `codeMatches: '정규식'` | 정규화 코드(주석·빈 줄·끝 공백 제거, 줄바꿈으로 이음)에 일치. `m` 플래그라 `^`·`$`는 줄 단위. 공백도 그대로 비교하니 필요하면 `\s*` |
| `codeEquals: { file, tolerance? }` | 정규화 코드가 파일과 줄마다 같다. 들여쓰기는 그대로, 문자열 밖 공백 차이(`d<15` / `d < 15`)는 무시. 문자열 밖 숫자는 차이가 `tolerance`(절대값, 기본 0) 안이면 같다 |
| `pinIs: { name, pin }` | `name = ...Pin(pin, ...)` 줄이 있다 (`led = Pin(26, Pin.OUT)`, `servo = PWM(Pin(4))`) |
| `maxBlocks: n` | 그림자 아닌 블록이 n개 이하 |
| `outputIncludes: 글` | 실행 출력에 그 글이 들어 있다 |
| `hasLine: { text, inside? }` | 정규화 코드에 **그 줄**이 있다(아래 "줄 비교"). `inside` 를 주면 그 줄이 속한 가장 가까운 블록 머리가 `loop`(`while`/`for`) · `def` · `if`(`if`/`elif`/`else`) · `top`(들여쓰기 0) 인 줄이 하나라도 있어야 한다. 들여쓰기로 판단: 위로 올라가며 처음 만나는 더 얕은 줄이 머리 |
| `notHas: 줄` | 그 줄이 **없다** (같은 줄 비교). 시작 코드에서 지워야 하는 줄에 쓴다 |
| `order: [줄, 줄, ...]` | 각 줄이 모두 있고 **첫 등장** 순서가 이 차례다 (2개 이상) |
| `count: { text, min?, max? }` | 그 줄의 개수가 `min` 이상 · `max` 이하 (둘 중 하나는 꼭). 같은 줄을 여러 번 붙여 쓴 것을 잡거나(`max: 1`), 지워야 하는 줄은 `max: 0` |

**줄 비교**(`hasLine`·`notHas`·`order`·`count`): 정규화 코드(주석·빈 줄 제거)의 줄과 `text` 를 각각 앞뒤 공백을 떼고, 공백 묶음은 한 칸으로, `'` 는 `"` 로 바꾼 뒤 **줄 전체**가 같은지 본다.
그래서 들여쓰기·주석·따옴표 종류는 상관없고(`show('OPEN', 'a')` = `show("OPEN", "a")`), 줄의 일부만 같은 것(`led.value` ↔ `led.value(1)`)이나 괄호 안 공백 차이(`led.value( 1 )`)는 다른 줄이다.
줄의 일부·숫자 범위·여러 줄 모양을 봐야 하면 `codeMatches` 를 쓴다. `notHas`·`hasLine.text` 에 따옴표가 든 줄은 YAML 작은따옴표로 감싼다(`notHas: 'show("ACCESS OK", "Door open")'`).

```yaml
rules:
  - hasLine: { text: "time.sleep(0.05)", inside: loop }
    fail: 반복 끝에서 쉬는 줄은 반복 안에 있나요?
  - notHas: time.sleep(2)
    fail: 반복 안에 깜박이던 줄이 아직 남아 있지 않나요?
  - order: ["led.value(1)", "time.sleep(2)", "led.value(0)"]
    fail: 켜기 → 기다리기 → 끄기 차례가 맞나요?
  - count: { text: "led_yellow.value(1)", max: 1 }
    fail: 같은 줄을 여러 번 붙여 쓴 노란불이 아직 남아 있지 않나요?
```

YAML에서 정규식은 작은따옴표로 감싼다(`'print\("가까워요!"\)'`) — 역슬래시가 그대로 들어간다.

### 규칙 유지 장치 (content 테스트)

`npm test` 가 모든 챕터의 `mission`·`debug` 규칙을 보호한다 (`src/track/content.test.ts`):

- `answerCode` 가 있으면 그 코드는 자기 규칙(debug 는 전체 규칙 + 증상 규칙)을 **모두 통과**해야 한다.
- `mission` 에 `code:`(시작 코드)가 있으면 그 코드는 **적어도 한 규칙에 실패**해야 한다 — 시작 코드가 그대로 통과하면 미션이 아니다. 시작 코드가 이미 정답인 미션(예: 선을 고치는 미션)은 `startPasses: true` 를 적어 예외로 둔다(그러면 반대로 시작 코드가 통과하는지 검사).
- 모든 규칙의 `fail` 은 **정답을 말하지 않는 되묻기** 꼴이어야 한다: 물음표로 끝나거나 중간에 `…요?` 물음(`…나요?`·`…인가요?`·`…까요?`)이 있어야 한다. "LED 핀은 26번이에요" 처럼 답을 말하는 문장은 걸린다.
