# 트랙 콘텐츠 형식 (chapter.yaml)

챕터 하나는 폴더 하나다: `content/chapters/<id>/chapter.yaml` + 같은 폴더의 `.py` 파일들.
`npm test`가 모든 YAML을 `src/track/schema.ts`(zod)로 검사한다. 키 오타, 없는 파일, 겹치는 id, 틀린 정규식,
범위 밖 답은 테스트에서 걸린다.

코드를 가리키는 키(`code`, `targetCode`, `lineExplain`, `answerCode`, `codeEquals.file`)는 **같은 폴더의 파일 이름**만 쓴다
(`code: step1_distance.py`). 예외: `debug`의 증상 `code`는 파일 이름이 아니라 **고장 난 코드 조각 그대로**다.

## 챕터

```yaml
id: 10-auto-door          # 폴더 이름과 같아야 함
order: 10                 # 목록 순서
title: 다가가면 열리는 자동문
subtitle: ...             # 선택
goals: { content: ..., thinking: ... }   # 선택
successCriteria: [...]    # 선택
parts:
  - id: part1
    title: 1부 · 초음파 센서 익히기
    steps: [ ... ]
```

## 단계 (공통 키)

| 키 | 뜻 |
|---|---|
| `id` | 챕터 안에서 겹치지 않는 영어 소문자·숫자·`-` (진행 기록의 키가 되므로 바꾸지 말 것) |
| `type` | 아래 8가지 + `debug` |
| `title` | 단계 제목 |
| `minutes` | 선택. 기준 시간(분) |
| `body` | 선택. 왼쪽 안내 칸 markdown |
| `optional` | 선택. `true`면 건너뛸 수 있고, 마치지 않아도 다음 단계가 열린다 |

## 유형별 키

| type | 키 |
|---|---|
| `problem` | `questions`: 열린 질문 1~3개 |
| `analysis` | `answer: { know: [...], decide: [...], act: [...] }` — 예시 답 (세 칸을 다 쓴 뒤에만 공개) |
| `predict` | `code`, `blanks: [{ q, unit? }]` — 빈칸 하나에 질문 하나 |
| `run` | `code` |
| `readcheck` | `code`, `questions: [...]` (아래) |
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
