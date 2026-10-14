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
order: 10                 # 목록 순서
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
| `type` | 아래 8가지 + `debug` |
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

`body`·`todo`·`summary`·`principle.body`·`expected` 는 라이브러리 없는 가벼운 markdown(`src/app/track/guideMarkdown.ts`)으로 그린다.

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
| `mission` | `instructions`, `code?`(미리 깔 코드), `hint?`, `rules`(1개 이상), `answerCode?` |
| `debug` | `symptoms: [{ title, code(코드 조각), question, rules? }]`, `rules?`(전체 규칙), `answerCode?` |
| `design` | `pseudocode: [{ text, blank?: { answer, tolerance? } }]`, `translation: [[우리말, 코드], ...]`, `targetCode` |
| `reflect` | `lineExplain`(줄마다 "이 줄은 ___" 을 쓸 코드), `prompts`: 정확히 4개 |

- `design.pseudocode`: `text`의 `__` 자리가 빈칸이고 `blank.answer`가 예시 답이다(글 또는 숫자). 빈칸 없는 줄은 `blank`를 빼면 된다.
  채점(`src/track/design.ts`): 숫자이거나 숫자로 시작하는 답(`15 cm`)은 학생 글의 첫 숫자를 `tolerance`(기본 0) 범위로, 글 답은 공백을 무시하고 비교한다. `문(서보)`처럼 괄호가 있으면 `문`, `서보`도 맞다.
  조립 작업판은 `targetCode`를 블록으로 바꾼 뒤 시작 블록 몸통의 명령 블록을 하나씩 떼어(안쪽 몸통은 그대로) 섞어 둔다. 판정은 `codeEquals targetCode`.
- `debug.symptoms[].rules`: 그 증상의 고장 코드를 고친 결과에 거는 규칙.

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

YAML에서 정규식은 작은따옴표로 감싼다(`'print\("가까워요!"\)'`) — 역슬래시가 그대로 들어간다.
