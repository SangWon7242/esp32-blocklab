# ESP32 블록랩 — 계획 3A: 트랙 엔진·콘텐츠·저장 (순수 계층 + 기본 화면)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 챕터 → 단계(8가지 유형) 트랙의 데이터 모델·관문·판정·저장을 순수 모듈로 만들고, 챕터 1·10 콘텐츠(YAML)를 지도안 그대로 담은 뒤, 트랙 목록·단계 화면의 글 입력형 단계(문제 만나기·조건 분석·예측·읽기 체크·성찰)를 먼저 연다. 편집기가 필요한 단계(실행·미션·디버깅·설계 조립)와 AI 점검은 계획 3B.

**Architecture:** `src/track/`(React·Blockly 비의존): zod 스키마, 콘텐츠 로더(`import.meta.glob` + `yaml`), 관문 계산, 판정 규칙, `ProgressStore`(localStorage). `src/app/track/`: 라우트 `#/track`, `#/track/:chapter`, `#/track/:chapter/:step`, 단계 유형별 컴포넌트. 기준 문서 8~9장.

**Spec:** `docs/superpowers/specs/2026-10-13-esp32-blocklab-design.md` §8–9, 지도안 `/Users/lucas/works/python_projects/python_esp32_project/챕터10-교사용지도안-110분.md`, 진행표 `챕터10-학생용-트랙진행표.md`.

## Global Constraints
- lucide·shadcn만, 이모지 금지, 학생 언어 한국어, 영어 식별자. `src/track` React 비의존. 기존 테스트 불변. 커밋마다 `npm test`·`npm run build`, 마지막에 e2e·푸시·배포 확인.
- 콘텐츠는 YAML(`content/chapters/<id>/chapter.yaml`), 코드 파일은 같은 폴더의 기존 `.py`를 `code: step1_distance.py`처럼 이름으로 참조. zod 검사가 빌드/테스트에서 돈다.
- "정답은 학생이 먼저 적은 뒤에만 공개", "읽기 체크 통과해야 다음 단계", "선택 단계는 건너뛸 수 있음", "교사 모드는 모두 열림".

## 파일 구조
```
src/track/schema.ts        zod: Chapter/Part/Step(유형별 discriminated union), Rule
src/track/content.ts       loadChapters(): Chapter[] (import.meta.glob('/content/chapters/*/chapter.yaml', {query:'?raw'}) + 코드 파일 glob)
src/track/gating.ts        stepStates(chapter, records, teacherMode) → Record<stepId, "locked"|"open"|"done">
src/track/judge.ts         judge(rules, {code, blocksJson, output}) → {pass, failures: string[]}
src/track/progress.ts      Progress/StepRecord 타입, ProgressStore 인터페이스, LocalProgressStore, export/import
src/track/*.test.ts
content/chapters/01-led/chapter.yaml, 10-auto-door/chapter.yaml
src/app/track/TrackPage.tsx (챕터 목록), ChapterPage.tsx (단계 목록·진행표), StepPage.tsx (틀: 왼쪽 안내, 오른쪽 활동, 하단 이전/다음·완료)
src/app/track/steps/{Problem,Analysis,Predict,ReadCheck,Reflect}.tsx, EditorStepPlaceholder.tsx (3B 안내)
src/app/settings/SettingsPage.tsx (교사 모드·가짜 보드·내보내기/불러오기/초기화)
src/app/App.tsx 라우트·메뉴 활성화
```

### Task 1: 순수 계층 + 콘텐츠
- 스키마(유형별 필드): `problem{questions[]}`, `analysis{answer{know,decide,act}}`, `predict{code, blanks[{q, unit?}]}`, `run{code}`, `readcheck{code, questions[{kind:"number"|"choice"|"line", q, options?, answer, hint}]}`, `mission{instructions, code?, hint?, rules: Rule[], answerCode?}`, `debug{symptoms[{title, code, question}], rules, answerCode}`, `design{pseudocode[{text, blank?: {answer, tolerance?}}], translation[[ko, py]], targetCode}`, `reflect{lineExplain: code, prompts[4]}`; 공통 `id, type, title, minutes?, body?, optional?`. `Rule` = `{useBlock: string[]} | {codeMatches: string} | {codeEquals: {file: string, tolerance?: number}} | {pinIs: {name, pin}} | {maxBlocks: n} | {outputIncludes: text}` + `fail: string`(정답 안 말하는 되묻기).
- 판정: `codeEquals`는 `normalizeCode` 뒤 줄 비교, 숫자 리터럴은 `tolerance`(절대값) 안이면 같다고 본다. `useBlock`은 블록 JSON 재귀. 실패 문장은 규칙의 `fail`.
- 관문: 첫 단계 open, 이전 필수 단계 done이면 다음 open, `optional` 단계는 건너뛰어도 그다음이 열림, 교사 모드는 전부 open(단 done 표시 유지).
- 저장: `StepRecord{status, input: Record<string, unknown>, attempts, updatedAt}`; 키 `esp32-blocklab:v1`; `exportJson`/`importJson`(형식 검사, 버전 필드).
- 콘텐츠 **챕터 1** (수업 저장소 README 기준): problem "LED는 어떻게 켜질까?"(질문: "전기가 흐르면 켜지는데, 흐르게 하는 건 무엇일까요?", "보드의 핀은 몇 번을 쓸까요? 왜 그 번호일까요?"), analysis(know: ["어느 핀에 LED가 있는지"], decide: ["켤지 끌지", "얼마나 오래 켜 둘지"], act: ["LED 켜기·끄기"]), predict(code step1_led_on.py, blanks: "실행하면 LED는?", "value(0)으로 바꾸면?"), run(step1_led_on.py), readcheck(code step4_blink_loop.py: number "켜져 있는 시간은 몇 초?" 1; choice "끄는 줄은?" ["led.value(1)","led.value(0)"] 1; line "1초 기다리는 첫 줄을 클릭" 7), mission(instructions "2초 켜고 1초 끄게 바꾸세요", code step4_blink_loop.py, rules [{codeEquals:{file:mission1_slow_blink.py}, fail:"켜진 시간과 꺼진 시간이 다른가요? time.sleep 숫자를 다시 보세요"}]), design(pseudocode "계속 반복한다 / LED를 켠다 / __초 기다린다 / LED를 끈다 / __초 기다린다", translation [["켠다","led.value(1)"],["기다린다","time.sleep(초)"],["계속 반복","while True:"]], targetCode step4_blink_loop.py), reflect(lineExplain step4_blink_loop.py, prompts 4개: 막힌 곳/해 본 것/원인/다음엔).
- 콘텐츠 **챕터 10**(지도안·슬라이드 그대로): 1부 — problem(슬라이드 6의 질문 3개: "문은 무엇을 '보고' 사람이 왔다고 판단할까요?", "얼마나 가까이 가야 열려야 할까요? 그 숫자는 누가 정하죠?", "사람이 지나간 뒤에 문은 언제 닫혀야 할까요?"), analysis(answer know ["앞에 무언가 있는지","그것이 몇 cm 떨어져 있는지"], decide ["몇 cm부터 열 것인지","몇 초 동안 열어 둘 것인지"], act ["문을 여닫는 것","지금 상태를 알려 주는 것"]), predict(code step1_distance.py, blanks ["센서 앞 1m 쯤 떨어진 벽을 향하면? (cm)","손바닥으로 센서를 완전히 덮으면? (cm)","창문 밖 허공을 향하면? (cm)"]), run(step1_distance.py), readcheck1(code step1_distance.py: choice "소리를 쏘는 핀은 둘 중 어느 것?" ["trig","echo"] 0, hint "trig 는 trigger(방아쇠)"; number "시간을 적어 두는 줄은 몇 개?" 2; number "t // 2 를 지우면 숫자가 몇 배가 될까요?" 2), mission(1부 연습: "15cm보다 가까워지면 창에 '가까워요!' 라고 찍어 주세요", code step1_distance.py, hint "if d < 15: 아래 줄은 한 칸 더 들여쓰기", rules [{codeMatches:"if d < 15:", fail:"거리를 판단하는 if 줄이 있나요? 15보다 작을 때예요"},{codeMatches:'print\\("가까워요!"\\)', fail:"가까울 때 찍을 말이 '가까워요!' 인가요?"}], answerCode practice_near.py), debug1(symptoms: "숫자가 계속 0만 나와요" code "trig = Pin(12, Pin.OUT)\necho = Pin(13, Pin.IN)" question "어디가 바뀌었나요?"; "IndentationError 가 떠요" code "if d < 15:\nprint(\"가까워요!\")" question "무엇이 빠졌나요?"; "10초에 한 번만 재요" code "trig.value(1)\ntime.sleep(10)\ntrig.value(0)" question "무엇이 잘못됐나요?"; rules per symptom via codeMatches: "trig = Pin\\(13", "    print", "sleep_us\\(10\\)"). 2부 — design(pseudocode "계속 반복한다 / 거리를 __ / 만약 거리가 __ 보다 작으면 / __ 를 연다 / __ 초 기다린다 / __ 를 닫는다 / __ 초 쉬었다가 다시 잰다", 예시 답 ["잰다","15 cm","문(서보)","3","문(서보)","0.3"], translation [["잰다","get_distance()"],["만약 ~면","if"],["연다","servo.duty_u16(8100)"],["닫는다","servo.duty_u16(1638)"],["기다린다","time.sleep(초)"]], targetCode step2_door.py), run(step3_auto_door.py), readcheck2(code step3_auto_door.py: number "문이 열려 있는 시간은 몇 초?" 3; number "show() 는 한 바퀴에 몇 번 불리나요?" 3 hint "열릴 때·닫힐 때·대기 화면"; number "if d < 15: 안에 들어 있는 줄은 몇 줄?" 7), mission(화면에 거리 표시: "대기 화면에도 지금 거리를 보여 주세요(한 줄 추가)", code step3_auto_door.py, rules [{codeMatches:'show\\("AUTO DOOR", str\\(d\\) \\+ " cm"\\)', fail:"대기 화면 줄에 거리(d)를 글자로 바꿔 넣었나요?"}], answerCode mission_show_distance.py), debug2(optional, symptoms "화면 글씨가 안 바뀌어요" code "oled.text(a, 0, 20)\noled.text(b, 0, 36)" question "적어 두는 것과 보여 주는 것은 같나요?" rule codeMatches "oled.show\\(\\)"), mission extra(optional: "문이 열리면 LED도 같이 켜기", rules [{useBlock:["esp_pin_write"], fail:"LED를 켜고 끄는 블록이 들어갔나요?"},{pinIs:{name:"led",pin:26}, fail:"LED 핀은 26번이에요"}], answerCode extra1_led.py), reflect(lineExplain step3_auto_door.py, prompts ["오늘 가장 오래 막혔던 곳은 어디였고, 어떻게 풀었나요?","15 라는 숫자를 왜 그 값으로 정했나요? 30이면 무엇이 달라지나요?","이 자동문을 학교 어디에 달면 좋을까요? 그러려면 무엇을 바꿔야 하죠?","다음엔 여기부터 본다: 한 줄로"]).
- 테스트: 두 YAML이 스키마를 통과, 단계 수(챕터 1: 8, 챕터 10: 15), 참조한 코드 파일이 존재; 관문 7가지 경우; 판정 6규칙; 저장 왕복(export → clear → import).
- 커밋 "트랙 엔진·콘텐츠·저장: 스키마, 관문, 판정, localStorage, 챕터 1·10".

### Task 2: 기본 화면
- `#/track`: 챕터 카드(진행률). `#/track/:chapter`: 단계 목록(잠김/열림/완료 아이콘, 선택 단계 표시, "이어서 하기"). `#/track/:chapter/:step`: 2단 틀(왼쪽 안내 markdown, 오른쪽 활동), 상단 진행 표시(현재/전체), 하단 이전·다음·"완료"(완료 조건 만족 시 활성). 유형 구현: problem(질문별 textarea), analysis(세 칸 textarea → "예시 답 보기"는 세 칸 다 쓴 뒤에만 → 대조 체크), predict(코드 읽기 전용 + 빈칸 입력), readcheck(코드 + 문항 3개 채점, 틀리면 hint·재시도), reflect(코드 줄별 "이 줄은 ___" + 성찰 4칸). run/mission/debug/design은 안내 카드("편집기 단계는 다음 업데이트에서 열립니다 — 자유 코딩에서 같은 코드를 열기" 버튼으로 `#/lab`에 코드 전달 `?code=<파일>`)로 두되 **완료 처리 가능**(교사 모드 또는 "건너뛰기")하지 않고 `optional`처럼 넘길 수 있게 한다(3B에서 교체).
- 설정 페이지: 교사 모드 스위치, 가짜 보드 스위치(`?device=fake` 대신 설정으로), 내보내기(JSON 다운로드)/불러오기(파일 선택)/초기화(확인 대화상자).
- e2e 3개: 챕터 목록 → 챕터 10 → 첫 단계 글 쓰고 완료 → 둘째 단계 열림; 읽기 체크 틀림→힌트→맞춤→완료; 설정 내보내기 JSON에 기록 포함.
- 커밋 → 푸시 → 배포 확인.
