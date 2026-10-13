# ESP32 블록랩 — 설계 문서

작성일: 2026-10-13
상태: 승인됨 (MVP)

## 1. 목적

ESP32(MicroPython)를 블록으로 조작하면서, 블록이 MicroPython 코드로 어떻게 바뀌는지와 코드가 블록으로 어떻게 되돌아오는지를 한 화면에서 확인할 수 있는 **무료 교육용 웹**을 만든다. 서버 없이 GitHub Pages에 배포한다.

두 가지 화면을 제공한다.

- **자유 코딩(Lab)**: 바로 블록·코드를 쓰고 보드에 올려 본다.
- **트랙(Track)**: code.org처럼 챕터 → 단계 순서로 미션을 수행하며 다음으로 넘어간다. 단계 구성은 선생님의 지도안(챕터 10 "다가가면 열리는 자동문" 110분 수업)의 사고 활동 8가지를 그대로 옮긴다.

### 수업 원칙 (화면이 지켜야 하는 것)

1. **코드는 복사, 생각은 직접.** 코드는 블록이나 파일로 주고, 읽기 체크·예측·디버깅·설계는 학생이 직접 한다.
2. **설명 못 하면 다음으로 넘어가지 않는다.** 읽기 체크와 성찰·설명 단계가 관문이다.
3. **문제 → (학생 활동) → 정답** 순서. 정답은 학생이 먼저 적은 뒤에만 열린다.
4. **문제를 쪼개서 조립한다.** 조건 분석(알아야/정해야/움직여야) → 우리말 의사코드 → 블록 조립 → 코드 순서로 간다.
5. AI는 정답을 주지 않는다. 되묻는 질문만 돌려준다.

## 2. 결정 사항 (브레인스토밍 결과)

| 항목 | 결정 |
|---|---|
| 블록 엔진 | **Blockly 13 + 엔트리 스킨.** entryjs 직접 사용은 번들 18MB·엔트리 전용 파이썬 문법·무대 의존성 때문에 제외 |
| 저장 | **브라우저(localStorage) 저장**, `ProgressStore` 인터페이스 뒤에 두어 2단계에서 Supabase(entry-hub와 공유)로 교체 가능하게 |
| 설명 점검 | 교사 출제 읽기 체크(자동 채점) + 줄별 설명 빈칸 + 성찰 저장 + **AI 점검(교사용 Claude API 키, 브라우저 직접 호출)** |
| MVP 챕터 | **챕터 1(LED 켜기)** 과 **챕터 10(자동문)** 두 개. 나머지는 콘텐츠 파일만 추가하면 들어가는 구조 |
| 보드 검증 | 실제 보드(Keyestudio ESP32 PLUS, MicroPython)를 USB로 연결해 Chrome에서 검증 |
| UI | **shadcn/ui**(Tailwind + Radix) 컴포넌트, 아이콘은 **lucide-react**, 이모지 사용 금지, 유연하고 직관적인 레이아웃(패널 크기 조절·접기) |
| 참고 오픈소스 | 화면 구성: Mind+, PictoBlox. 블록↔텍스트: BlockPy, EduBlocks. 보드 연결: ViperIDE, BIPES. 블록 문구·색: entryjs(Apache-2.0) 언어 파일과 색상표 |

## 3. 기술 스택

- Vite + React 19 + TypeScript, 정적 SPA, GitHub Pages 배포(GitHub Actions)
- Blockly 13 (Zelos 렌더러, 커스텀 테마), `blockly/msg/ko`
- CodeMirror 6 (`@codemirror/lang-python`) 텍스트 편집기, `@lezer/python` 파서
- Web Serial API (Chrome/Edge)
- shadcn/ui + Tailwind CSS 4 + lucide-react
- 콘텐츠: YAML(`yaml` 패키지), 빌드 시 형식 검사(zod)
- 테스트: Vitest(단위·왕복), Playwright(스모크)

## 4. 폴더 구조와 모듈 경계

```
esp32-blocklab/
  src/
    blocks/      블록 정의(JSON) · 카테고리(툴박스) · 엔트리 테마       → Blockly만 의존
    codegen/     블록 → MicroPython 생성기                            → blocks 의존
    parser/      MicroPython → 블록 JSON (lezer, 부분집합)              → 순수 함수, Blockly 비의존
    device/      Device 인터페이스 · WebSerialDevice · FakeDevice · raw REPL
    track/       챕터 스키마(zod) · 단계 유형 · 판정 규칙(judge) · 관문 계산
    storage/     ProgressStore 인터페이스 · LocalProgressStore · 내보내기/불러오기
    ai/          Claude API 호출 · 프롬프트 · 응답 형식
    app/         라우팅 · 화면 · 상태 연결 (Lab, Track, Settings)
    components/  shadcn/ui 컴포넌트와 공용 UI
  content/
    chapters/01-led/chapter.yaml, *.py
    chapters/10-auto-door/chapter.yaml, *.py
  docs/superpowers/specs/, docs/superpowers/plans/
  .github/workflows/deploy.yml
```

각 모듈은 "무엇을 하는가 / 어떻게 쓰는가 / 무엇에 의존하는가"가 한 문단으로 설명돼야 하고, `app/` 밖의 모듈은 React에 의존하지 않는다.

## 5. 블록 어휘 (MVP)

카테고리와 순서는 엔트리를 따른다. 블록 문구는 entryjs `extern/lang/ko.js`의 표현을 참고한다.

| 카테고리 | 블록 | 생성 코드 |
|---|---|---|
| 시작 | 프로그램이 시작되면 | (최상위 묶음, 코드 없음) |
| 흐름 | 계속 반복하기 | `while True:` |
| 흐름 | (n)번 반복하기 | `for i in range(n):` |
| 흐름 | 만약 (조건)이라면 / 아니면 / 아니면 만약 | `if / elif / else` |
| 흐름 | (n)초 기다리기 | `time.sleep(n)` |
| 흐름 | (n)밀리초 기다리기 | `time.sleep_ms(n)` |
| 판단 | (a) (<,>,==,!=,<=,>=) (b) | 비교식 |
| 판단 | 그리고 / 또는 / 아니다 | `and / or / not` |
| 계산 | 사칙연산, 나머지, 몫 | `+ - * / % //` |
| 계산 | (a)와 (b) 합치기 | `a + b` (문자) |
| 계산 | (값)을 글자로 | `str(값)` |
| 계산 | 숫자, 글자 | 리터럴 |
| 변수 | (변수)를 (값)으로 정하기 / (변수) 값 | 대입 / 참조 |
| 함수 | 함수 (이름) 정의하기 / (이름) 함수 실행하기 / 값 돌려주기 | `def` / 호출 / `return` |
| ESP32 | 핀 (n)을 출력으로 (이름) 만들기 / 입력으로 만들기 | `이름 = Pin(n, Pin.OUT)` / `Pin.IN` |
| ESP32 | (이름) 켜기 / 끄기 / 값 | `.value(1)` / `.value(0)` / `.value()` |
| ESP32 | 핀 (n)을 PWM (이름)으로 만들기, 주파수 (f) | `이름 = PWM(Pin(n)); 이름.freq(f)` |
| ESP32 | (이름) 세기를 (0~65535)로 | `.duty_u16(v)` |
| ESP32 | 초음파 센서 trig (n) echo (m) 준비하기 | `trig = Pin(n, Pin.OUT); echo = Pin(m, Pin.IN)` + `get_distance()` 정의 |
| ESP32 | 거리(cm) | `get_distance()` |
| ESP32 | 서보 (이름) 열기(8100) / 닫기(1638) / 값 (v) | `.duty_u16(...)` |
| ESP32 | OLED 준비하기 scl (22) sda (21) | `SoftI2C` + `ssd1306.SSD1306_I2C(128, 64, i2c)` + `show(a, b)` 정의 |
| ESP32 | 화면에 (a), (b) 보여주기 | `show(a, b)` |
| ESP32 | 출력하기 (값) | `print(값)` |
| 코드 | 코드 블록 (텍스트 그대로) | 입력한 줄 그대로 |

생성 코드는 **수업 저장소(`SangWon7242/esp32-micropython-class`)의 코드와 같은 모양**을 목표로 한다. 핀·장치 준비 블록은 코드 상단에 모이고, `get_distance()`·`show()` 같은 도우미 함수는 머리말에 한 번만 정의된다. 그래야 읽기 체크 문항이 블록으로 만든 코드에도 그대로 통한다.

## 6. 양방향 변환

**블록 → 코드**: Blockly 파이썬 생성기를 바탕으로 블록별 생성기를 쓴다. `import` 줄은 사용된 블록에 따라 자동으로 모인다(`from machine import Pin, PWM, SoftI2C`, `import time`, `import ssd1306`).

**코드 → 블록**: `@lezer/python`으로 파싱한 뒤 수업 문법 부분집합만 블록으로 바꾼다.

- 다루는 문법: `import`, `from … import`, 대입, 호출, 속성 호출, `while True`, `for … in range`, `if/elif/else`, `def`, `return`, 비교·논리·사칙, `print`, `str()`, 숫자·문자 리터럴, 주석(블록 코멘트로 보존).
- 알려진 하드웨어 패턴(`Pin(13, Pin.OUT)`, `PWM(Pin(4))`, `servo.duty_u16(8100)`, `get_distance()`, `show(a, b)`)은 ESP32 블록으로 되돌린다. `get_distance`·`show` 함수 정의 본문이 표준 형태와 같으면 "준비하기" 블록 하나로 접는다.
- 변환할 수 없는 줄은 **코드 블록**에 담아 왕복이 깨지지 않게 한다. 코드 패널에 "블록으로 바꾸지 못한 줄 n개" 표시를 띄운다.

**동기화 규칙**: 블록 편집 중에는 블록이 기준이고 코드 패널은 읽기 전용으로 즉시 갱신된다. "코드 편집" 전환 시 코드가 기준이 되고, 입력 멈춤 300ms 뒤 파싱해 블록을 갱신한다. 파싱 오류(문법 오류)가 있으면 블록은 마지막 성공 상태를 유지하고 코드 패널에 오류 줄을 표시한다.

**검증**: 챕터 1·10의 코드 파일 전부를 "코드 → 블록 → 코드" 왕복시켜 정규화(공백·빈 줄·주석 제외) 후 원문과 같아야 한다.

## 7. 보드 연결 (device)

- `Device` 인터페이스: `connect()`, `disconnect()`, `run(code)`, `saveFile(path, text)`, `stop()`, `onOutput(cb)`, `status`.
- `WebSerialDevice`: 115200bps. ViperIDE와 같은 raw REPL 절차. Ctrl-C ×2 → Ctrl-A → 코드 전송(256바이트 단위) → Ctrl-D → `OK` 수신 → 출력 스트리밍 → `\x04\x04>`에서 종료 → Ctrl-B.
  - **실행**: 저장 없이 raw REPL로 바로 실행.
  - **보드에 저장**: `main.py`(또는 지정 파일)에 써 넣고 소프트 리셋(Ctrl-D). `ssd1306.py` 라이브러리 올리기도 같은 경로.
  - **멈춤**: Ctrl-C ×2.
- `FakeDevice`: 테스트와 보드 없는 시연용. 코드에서 `print` 줄을 찾아 미리 정한 값(예: 거리 23)을 흘려 준다.
- **시리얼 모니터**: 출력과 에러를 보여 준다. `Traceback` 안의 `line N`을 잡아 코드 패널의 해당 줄과 그 줄을 만든 블록을 함께 강조한다.
- 오류 안내 문구는 지도안 5장 표를 따른다: Web Serial 미지원 → "Chrome에서 열어 주세요", 포트를 못 열면 → "보드 포트를 열 수 없어요. 다른 프로그램(PyCharm 등)이 쓰고 있으면 닫고, 아니면 USB를 뽑았다 다시 꽂아 보세요"(macOS CH340 드라이버가 꼬인 경우도 여기 해당), 포트는 열렸는데 raw REPL 응답이 없으면 → "보드가 대답하지 않아요. MicroPython이 들어 있는 보드인지 확인해 주세요"(2026-10-14 실보드 검증에서 추가: 아두이노 스케치가 든 보드), 실행 중 응답 없음 → "코드가 지금 무엇을 기다리고 있을까요? 멈춤을 눌러 보세요".

## 8. 트랙 구조

### 8.1 데이터 모델

```
Chapter { id, order, title, subtitle, goals: {content, thinking}, successCriteria[], parts: Part[] }
Part    { id, title, steps: Step[] }
Step    { id, type, title, minutes?, body(markdown), ...유형별 필드 }
```

### 8.2 단계 유형 8가지와 완료 조건

| type | 화면 | 완료 조건 |
|---|---|---|
| `problem` | 열린 질문 1~3개 + 공책 입력란 | 입력 저장 |
| `analysis` | 세 칸 보드(알아야/정해야/움직여야) 각 칸 1~3줄 → "예시 답 보기" → 대조 체크 | 세 칸 모두 1줄 이상 + 대조 체크 |
| `predict` | 코드(읽기 전용) + 빈칸 n개. 실행 단계 뒤 실제값과 나란히 표시 | 빈칸 모두 입력 |
| `run` | 미리 깔린 블록(또는 코드) + 보드 연결·실행 | 실행 성공 1회 (FakeDevice 포함) |
| `readcheck` | 코드 + 문항 3개. 형식: 숫자, 선택지, 블록/줄 클릭 | 전부 정답 (틀리면 해당 줄 다시 읽기 안내, 재시도 무제한) |
| `mission` | 지시문 + 편집기(블록/코드) + 판정 버튼 | 판정 규칙 전부 통과 |
| `debug` | 증상 설명 + 고장 코드. **"왜 이런 증상일까?" 설명을 먼저 써야 편집기가 열림** | 설명 저장 + 판정 통과 |
| `design` | ① 우리말 의사코드 빈칸 → ② 번역표(우리말 ↔ 코드) → ③ 흩어진 블록을 순서대로 조립(Parsons) | 조립 코드가 기대 코드와 일치(숫자는 허용 범위) |
| `reflect` | 완성 코드 줄별 "이 줄은 ___" 빈칸 + 성찰 틀(막힌 곳 → 해 본 것 → 원인 → 다음엔) + AI 점검(선택) | 빈칸 전부 + 성찰 4칸 저장 |

`debug`는 `mission`의 변형이며 유형 수로는 8가지(지도안의 사고 활동 8가지와 1:1)다.

### 8.3 관문 규칙

- 단계는 순서대로 열린다. 이전 단계가 완료되면 다음 단계가 열린다.
- `optional: true` 단계(추가 미션, 디버깅 ②)는 건너뛸 수 있다.
- 교사 모드에서는 모든 단계·정답이 열리고, 정답 패널이 바로 보인다.

### 8.4 판정 규칙 (순수 함수, `track/judge.ts`)

| 규칙 | 뜻 |
|---|---|
| `useBlock(types[])` | 해당 블록 중 하나 이상 사용 |
| `codeMatches(pattern)` | 정규화 코드에 정규식 일치 |
| `codeEquals(expected, tolerance?)` | 정규화 코드가 기대 코드와 일치. 숫자 리터럴은 허용 범위 안이면 통과 |
| `pinIs(name, n)` | `name = Pin(n, …)` 핀 번호 확인 |
| `maxBlocks(n)` | 블록 수 상한 |
| `outputIncludes(text)` | 실행 출력에 문자열 포함 (FakeDevice 포함) |

실패 시 학생에게 보여 줄 문장은 규칙마다 정해져 있고, 정답을 말하지 않는다("`if` 줄 끝에 무엇이 있어야 할까요?").

### 8.5 콘텐츠 형식

```yaml
# content/chapters/10-auto-door/chapter.yaml
id: 10-auto-door
order: 10
title: 다가가면 열리는 자동문
goals:
  content: 초음파로 잰 거리를 if 로 판단해 서보와 OLED를 함께 제어한다
  thinking: 문제를 세 덩어리로 분해하고, 결과를 예측하고, 증상에서 원인을 역추적한다
parts:
  - id: part1
    title: 1부 초음파 센서 익히기
    steps:
      - id: problem
        type: problem
        title: 문제 만나기 — 백화점 문은 어떻게 알까?
        questions: ["문은 무엇을 '보고' 사람이 왔다고 판단할까요?", ...]
      - id: analysis
        type: analysis
        answer:
          know: ["앞에 무언가 있는지", "몇 cm 떨어져 있는지"]
          decide: ["몇 cm부터 열 것인지", "몇 초 동안 열어 둘 것인지"]
          act: ["문을 여닫는 것", "지금 상태를 알려 주는 것"]
      - id: readcheck1
        type: readcheck
        code: step1_distance.py
        questions:
          - { kind: choice, q: "소리를 쏘는 핀은?", options: ["trig", "echo"], answer: 0 }
          - { kind: number, q: "시간을 적어 두는 줄은 몇 개?", answer: 2 }
          - { kind: line, q: "t // 2 를 계산하는 줄을 클릭하세요", answer: 14 }
```

zod 스키마로 빌드 시 검사한다. 코드 파일은 수업 저장소와 같은 이름을 쓴다.

### 8.6 MVP 챕터

- **챕터 1 LED 켜기**: problem → analysis → predict → run(`led_on.py`) → readcheck → mission(깜빡이게) → design(의사코드 → 조립) → reflect
- **챕터 10 자동문**: 지도안의 31장 흐름을 그대로. 1부(problem, analysis, predict, run, readcheck①, mission 연습, debug①) · 2부(design, run 완성, readcheck②, mission 화면 표시, debug②(선택), mission 추가(선택), reflect)

## 9. 저장 (storage)

```ts
interface ProgressStore {
  load(): Promise<Progress>;
  saveStep(chapterId, stepId, StepRecord): Promise<void>;
  saveLabProject(LabProject): Promise<void>;
  exportJson(): Promise<string>;
  importJson(text): Promise<void>;
  clear(): Promise<void>;
}
```

`StepRecord`는 상태(locked/open/done), 학생 입력(글·답·코드의 블록 JSON과 파이썬 텍스트), 시도 횟수, 시각을 담는다. `LocalProgressStore`가 MVP 구현이고 저장 키는 `esp32-blocklab:v1`. 설정 화면에서 JSON 내보내기·불러오기·초기화를 제공한다. 2단계에 `SupabaseProgressStore`를 같은 인터페이스로 추가해 entry-hub에 iframe으로 들어간다.

## 10. AI 점검 (ai)

- 설정 화면에 교사용 Claude API 키를 넣는다. 키는 localStorage에만 저장되고 서버를 거치지 않는다. 브라우저에서 Claude API를 직접 호출한다(`anthropic-dangerous-direct-browser-access` 헤더).
- 기본 모델 `claude-sonnet-5-5`, 설정에서 변경 가능.
- 호출 지점 두 곳:
  - **내 설명 점검 받기**(reflect): 완성 코드 + 줄별 설명 + 성찰 글을 보내고, 맞게 설명한 부분·빠진 부분과 **되묻는 질문 3개**를 JSON으로 받는다. 정답 코드를 쓰지 않도록 시스템 프롬프트에 명시한다.
  - **질문 3개만 받기**(debug): 고장 코드와 증상을 보내고 "어디부터 볼지" 묻는 질문 3개만 받는다.
- 키가 없으면 버튼이 숨겨진다. 호출 실패는 메시지만 띄우고 진행을 막지 않는다. AI 응답은 StepRecord에 함께 저장한다.

## 11. UI 원칙

- shadcn/ui 컴포넌트(Button, Card, Tabs, Resizable, Sheet, Dialog, Badge, Progress, Tooltip, Toast)와 Tailwind. 아이콘은 lucide-react만. 이모지 금지.
- 자유 코딩 화면은 3단(팔레트·작업판·코드)에 하단 시리얼 모니터. 패널은 `Resizable`로 크기 조절·접기가 된다. 좁은 화면(1024px 미만)에서는 코드 패널이 탭으로 바뀐다.
- 트랙 단계 화면은 왼쪽 안내(문제·지시·힌트), 오른쪽 작업 영역(그 단계에 필요한 편집기만). 상단에 단계 진행 표시(현재/전체, 완료 표시).
- 상태 색: 열림·완료·잠김을 색과 아이콘(Lock, Circle, CheckCircle2)으로 함께 표시.
- 글꼴 Pretendard. 문구는 학생 언어(지도안의 말투)로 쓴다.

## 12. 테스트

- Vitest: 블록별 생성기, 파서 문법별, **왕복 테스트**(챕터 1·10 코드 전부), judge 규칙, YAML 스키마, FakeDevice로 raw REPL 상태 전이.
- Playwright 스모크: 자유 코딩 화면에서 블록 추가 시 코드 변경, 트랙 첫 단계 열림.
- 실제 보드: Chrome에서 연결·실행·저장·멈춤·에러 줄 강조를 직접 확인하고 결과를 기록한다.

## 13. 배포와 커밋

- GitHub 저장소 `SangWon7242/esp32-blocklab`, GitHub Actions로 `main` 푸시 시 빌드·Pages 배포. 주소 `https://sangwon7242.github.io/esp32-blocklab/`.
- 기능 단위 커밋 순서: ① 뼈대·shadcn·배포 → ② 블록 어휘·엔트리 테마 → ③ 생성기 → ④ 파서·왕복 → ⑤ 보드 연결·시리얼 모니터 → ⑥ 자유 코딩 화면 → ⑦ 트랙 엔진·단계 유형 → ⑧ 챕터 1 → ⑨ 챕터 10 → ⑩ 저장·설정·AI 점검 → ⑪ 마무리 점검. 각 커밋은 테스트 통과 상태.

## 14. 범위 밖 (2단계)

Supabase 저장·교사 대시보드, 챕터 2~9 콘텐츠, Wi-Fi/WebREPL 연결, 화면 속 보드 시뮬레이터, Mind+식 실시간 모드(블록이 PC에서 돌고 보드는 명령만 받는 방식), 학생 계정.

## 15. 참고

- 수업 저장소: https://github.com/SangWon7242/esp32-micropython-class
- 지도안·진행표: `python_esp32_project/챕터10-교사용지도안-110분.md`, `챕터10-학생용-트랙진행표.md`
- Blockly: https://github.com/google/blockly · ViperIDE: https://github.com/vshymanskyy/ViperIDE · BIPES: https://github.com/BIPES/BIPES · BlockPy: https://github.com/blockpy-edu/blockpy · entryjs: https://github.com/entrylabs/entryjs
