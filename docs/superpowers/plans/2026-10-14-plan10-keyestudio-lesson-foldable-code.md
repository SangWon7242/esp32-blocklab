# ESP32 블록랩 — 계획 10: Keyestudio 수업 구조 반영 + 수업 코드를 전부 블록으로

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** (1) Keyestudio KS5020 MicroPython 튜토리얼의 수업 구조(개요 → 원리 → 부품 → 배선 → 코드 → 실행 결과 → 코드 설명)와 부품·선 이름(브레드보드 + 점퍼선 / M-F 듀폰선 / F-F 듀폰선)을 트랙에 반영한다. (2) 수업 코드 파일이 **한 줄도 "블록으로 바꾸지 못한 줄" 없이** 블록으로 돌아오게 한다: 수업에 꼭 필요하지 않은 꼴(`machine.Pin`, `PWM(Pin(26, Pin.OUT), 10000)`, `try/except`, `gfx`)은 블록이 아는 꼴로 고쳐 쓰고, 수업의 핵심인 꼴(리스트로 핀 준비, 거꾸로 반복, 걸음 있는 범위, RFID 읽기, 7세그먼트 시프트)은 블록을 그에 맞게 설계한다.

**참고 자료:** Keyestudio 튜토리얼 본문 추출: `<scratchpad>/keyestudio/tutorial.txt`, 프로젝트별 `sec_*.txt`(hello_led, breathing, traffic, flowing, rgb, hc595, tube, fan, servo, ultrasonic, oled, rfid, access). 수업 구조: `1. Overview / 2. Working Principle / 3. Components / 4. Wiring Diagram / 5. Test Code / 6. Test Result / 7. Code Explanation`. 부품: LED 계열 = `breadboard x1 + jumper wires`, 선풍기·초음파 = `M-F DuPont wires`, RFID·OLED·출입통제 = `F-F DuPont wires`, 서보 = 선 없이 직접.

**현재 블록으로 안 바뀌는 줄(`/tmp/unparsed.txt` 요약):** 2장 `PWM(Pin(26, Pin.OUT), 10000)`·`try:`; 4장 `Pin(pin, Pin.OUT)`(변수 핀)·`led.value()`·`reversed(pins)`; 5장 `PWM(Pin(RED_PIN))`·`color_to_duty`; 6장 `import machine`·`machine.Pin`·`SEGCODE` 리스트·비트 밀기 반복·`range(7, -1, -1)`·`range(9, -1, -1)`; 7장 `PWM(Pin(13), 1000)`; 8·9장 `mfrc522(...)`·`PCD_Init`·`PICC_*`·`uid.uidByte[...]`·`ShowReaderDetails`; 9장 OLED `fill/text/show`(도우미 없는 준비)·`gfx`; 10장 `time.ticks_*`(두 줄짜리 get_distance).

## Global Constraints
- 수업의 뜻이 바뀌지 않게: 핀 번호·동작·미션 조건은 그대로. 코드 파일 수정은 "블록이 아는 꼴로 바꾸기"에 한정하고, 바꾼 이유를 그 챕터 보고에 적는다. 읽기 체크 `line` 답·설계 `targetCode`·미션 규칙은 바뀐 파일에 맞춰 다시 센다.
- 끝나면 `src/parser/roundtrip.test.ts` 가 **모든 챕터**에 대해 "글자 그대로 왕복 + unparsed 0" 을 요구하도록 되돌린다(`EXACT_CHAPTERS` 제거).
- lucide·shadcn, 이모지 금지, 한국어, 방향어 금지. 커밋마다 `npm test`·tsc·build, 마지막에 e2e.

## Task 1 (형식·화면, 다른 작업과 병렬): Keyestudio 수업 구조
- `src/track/schema.ts`: 챕터 `principle?: { body: string(markdown); image?: string }`(2. 원리), 챕터 `materials[].kind?: "wire" | "part" | "board"`(선 종류 표시용 — 선택), run 단계 `expected?: string`(6. 실행 결과: "코드를 올리면 … 보여요"), run·readcheck 단계 `codeNotes?: { line: number; note: string }[]`(7. 코드 설명: 줄 번호 → 우리말 설명). README 갱신.
- 화면: 챕터 페이지 hero 아래 "원리" 카드(그림+글, Collapsible 기본 펼침), 단계 안내 칸에 run 의 `expected` 를 "이렇게 되면 성공" 카드로, 읽기 전용 코드 옆(또는 아래)에 `codeNotes` 를 줄 번호 배지 + 설명 목록으로(클릭하면 그 줄 강조 — 기존 줄 강조 API 재사용). 테스트: 스키마, `codeNotes.line` 이 파일 줄 수 안인지 content 검사.
- 커밋 "트랙 형식: 원리·실행 결과·코드 설명(Keyestudio 수업 구조)".

## Task 2 (블록·파서·생성기, Task 1 과 병렬)
- 새 블록: `esp_pin_setup_var`("변수 %1 번 핀을 %2 으로 준비하고 %3 이름 붙이기": PINVAR field_variable, MODE 출력/입력, VAR) → `led = Pin(pin, Pin.OUT)`; 파서는 `Pin(<이름>, Pin.OUT|Pin.IN)` 의 첫 인자가 등록된 변수면 이 블록으로(kind "pin" 으로 등록해 `led.value()` 등이 그대로 붙게). `list_reversed`("%1 을(를) 거꾸로") → `reversed(X)`. `flow_for_range_step`("%1 을(를) %2 부터 %3 전까지 %4 씩 바꾸며 반복") → `for VAR in range(A, B, C):`; 파서 range 인자 3개 → 이 블록(음수 걸음 포함).
- OLED: `show(a, b)` 도우미를 준비 블록의 필수 도우미에서 떼어 **명령 블록이 쓰는 선택 도우미**로(`ActionSpec.helper?: HelperSpec`: 생성기는 그 블록이 쓰일 때만 `provideFunction_` 로 정의를 내고, 파서는 같은 이름·본문의 최상위 def 를 접는다; 준비 블록은 도우미 없이도 접힌다). `dev_oled_fill_rect`("%1 에 채운 네모 (x %2, y %3, 너비 %4, 높이 %5)") 추가. `src/devices/types.ts`·`toBlocks`·`toCodegen`·`parser/devices.ts` 가 `helper` 를 다루게. 10장 파일은 그대로 글자 왕복해야 한다.
- RFID·7세그먼트·RGB·초음파는 블록 꼴을 유지(Task 3 가 코드를 그 꼴로 고친다). 단, 초음파 `get_distance` 도우미 본문이 선생님 `step1_distance.py` 와 글자까지 같은지 확인하고 다르면 **도우미 쪽을** 선생님 꼴로 맞춘다(읽기 체크 "시간을 적어 두는 줄" 질문이 그 본문을 본다).
- 블록 사전 내용(새 블록 4개 + fill_rect), 툴박스, 검사 라벨, 왕복 테스트. 커밋 "블록: 변수 핀 준비·거꾸로·걸음 반복·OLED 채운 네모, OLED 도우미는 선택".

## Task 3 (콘텐츠, Task 2 뒤; 1~5장 / 6~10장 두 작업 병렬)
- 코드 파일을 블록이 아는 꼴로: 2장 `pwm = PWM(Pin(26))`+`pwm.freq(10000)`, `try/except` 제거(멈춤은 앱의 멈춤 버튼; `deinit` 은 코드 설명에만 언급); 4장 그대로(새 블록이 받는다); 5장 RGB 블록 꼴(`red = PWM(Pin(27))`… `set_color` 도우미, `color_to_duty` 대신 블록의 `r * 1023 // 255`); 6장 `from machine import Pin` + 7세그먼트 블록 꼴(`hc595_shift`·`SEGCODE`·`show_digit`), 카운트다운은 걸음 반복; 7장 extra2 `motor1a = PWM(Pin(13))`+`freq(1000)`; 8·9장 RFID 블록 꼴(`card_present()`·`card_uid()` 도우미, `ShowReaderDetails`·`addr` 변수 제거); 9장 step2 는 `oled.line/rect/fill_rect` 로(gfx·circle 제거), step1 은 그대로(도우미 없는 준비가 접힘); 10장 `step1_distance.py` 는 도우미 꼴로.
- 모든 챕터: `principle`(Keyestudio Working Principle 을 학생 말로 2~4문장 + 기존 원리 그림), run `expected`(Test Result), run·readcheck `codeNotes`(Code Explanation; 줄마다 한 줄), 준비물 이름을 Keyestudio 식으로(브레드보드·점퍼선 / M-F 듀폰선 / F-F 듀폰선).
- 읽기 체크 답·설계 target·미션 규칙 재검증; `npm test` 전부(왕복 strict) 통과. 커밋 "챕터 N~M: 수업 코드 블록화, 원리·실행 결과·코드 설명".

## 완료 조건
- 모든 content .py 가 unparsed 0 으로 글자 그대로 왕복, 트랙에 원리·실행 결과·코드 설명이 보이고, 준비물이 Keyestudio 식 이름. 단위·e2e 통과, 배포.
