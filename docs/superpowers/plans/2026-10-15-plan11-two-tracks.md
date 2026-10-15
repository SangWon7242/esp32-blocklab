# ESP32 블록랩 — 계획 11: 센서 트랙 / 교과 융합 트랙, 슬라이드 내보내기, 새 챕터 S8~S23·F4~F16, 앱 단계

> **For agentic workers:** superpowers:subagent-driven-development. 단계(①~⑤) 순서로, 각 단계 안에서는 폴더가 다른 작업을 병렬로.

**근거:** `docs/reports/2026-10-15-legacy-courses-to-esp32.md` 3절(두 트랙 표), 8절(슬라이드 자동 생성), 9절(앱 단계). 차시별 원본 분석: `docs/reports/legacy-analysis/*.md`(각 차시의 학습 목표·활동·미션·디버깅·융합 요소를 여기서 가져온다). 선생님 결정: 이 순서로 진행, BLE·ESP-NOW 후순위, 완성본을 보고 직접 수정 요청.

## Global Constraints
- 기존 형식·규칙 유지: 8단계 사고 활동, 장면 그림·지금 할 일·원리·실행 결과·코드 설명, 브레드보드 배선도(Keyestudio 선 이름), 학생 말(방향어·이모지 금지), 되묻기, 모든 수업 .py 는 unparsed 0 으로 글자 그대로 왕복(`src/parser/roundtrip.test.ts`), 검사 0, 챕터 id 불변.
- 핀: Keyestudio 튜토리얼·기존 챕터와 맞춘다(버튼 14, 터치 4(T0)/13(T4)/15(T3)/27(T7)/32(T9)/33(T8), 부저 25, 마이크 36, 가변저항 39, 조도 34, DHT11 13, 틸트 14, PIR 23, 초음파 13/12, 서보 4, 조이스틱 X 36·Y 39·SW 14(S16 은 버튼과 겹치지 않게 재배정), 키패드 행 4·5·18·19·열 21·22·23·25 → 실제 키트 튜토리얼 핀을 확인해 쓴다). WiFi 쓰는 챕터의 아날로그는 GPIO32~39.
- 커밋마다 `npm test`·tsc·build, 단계 끝에 e2e, 푸시·배포 확인.

## ① 구조 (병렬 3작업)
- **A. 트랙 구조:** `schema.ts` 챕터에 `track: "sensor" | "fusion"`(필수), `code: "S8"` 같은 표시 번호(`label`), `prerequisites?: string[]`(챕터 id), `subjects?: string[]`, `sdg?: number[]`, `sessions?: number`, `status?: "draft" | "published"`(기본 published; draft 는 교사 모드에서만 목록에 보이고 주소로는 열림), `teacherNotes?: string`(markdown; 교사 모드에서만 챕터 페이지 아래에). `TrackPage` 를 두 탭(센서 트랙 / 교과 융합 트랙, URL `?track=`)으로, 카드에 번호·교과 태그·"먼저 할 챕터"(링크, 완료 여부 표시). `ChapterPage` hero 에 트랙 배지·교과·SDG·차시 수·먼저 할 챕터. 기존 1~7 → sensor S1~S7, 8·9·10 → fusion F1~F3(prerequisites 는 ② 에서 생기는 S14·S18·S19·S15 를 미리 적어 두되, 없는 id 는 목록에서 "준비 중"으로). README·테스트·e2e.
- **B. 슬라이드 내보내기:** `scripts/export-slides.ts`(실행 `npm run slides -- <chapter id|all>`): `pptxgenjs` 로 챕터당 pptx 를 `slides/<id>.pptx` 에 만든다. 장: 표지(제목·요약·표지 그림) → 목표·성공 기준 → 준비물 → 배선(배선도 + 캡션) → 원리 → 단계마다 1~3장(제목·장면 그림·상황 글·지금 할 일; run 은 코드 카드 + 실행 결과 + 코드 설명; readcheck 는 문항(답 없이); mission 은 지시·힌트; debug 는 증상·되묻기; design 은 의사코드 빈칸·번역표; reflect 는 문항) → 교사 메모(teacherNotes, 마지막 장 "교사용"). SVG 는 Playwright(chromium)로 PNG 로 그려 넣는다(`npx playwright install chromium` 가정). 한글 글꼴은 시스템 기본(맑은 고딕/애플 SD 고딕) 지정. 빌드 산출물 `slides/` 는 gitignore. 테스트: 1·10장 내보내기가 오류 없이 파일을 만들고 장 수가 단계 수 이상.
- **C. 블록 보강(②용):** `touch`(내장 터치패드: `dev_touch_setup`(핀, 이름), `dev_touch_value`(값), `dev_touch_pressed`(기준보다 작은가 — 터치하면 값이 줄어듦)); 버튼 인터럽트 `dev_button_irq`("버튼 %1 이 눌렸을 때 %2 를 실행" → `button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)` + 함수 정의 블록과 연결: 핸들러는 함수 블록 이름을 드롭다운으로); 시간 `flow_elapsed`("%1 ms 지났으면 (기준 %2)" 또는 더 단순한 `calc_elapsed` "%1 부터 지난 ms") ; `calc_map`("%1 을 %2~%3 에서 %4~%5 로 바꾸기" → `(x - a) * (d - c) // (b - a) + c`); 부저 `dev_buzzer_tone`(주파수·초) 가 있는지 확인·보강; 키패드·IR·PIR·틸트·조이스틱 블록은 있으니 확인만. 블록 사전 내용·왕복 테스트.

## ② 센서 트랙 S8~S21 (①C 뒤, 4개씩 병렬; id 와 순서)
`11-button-touch`(S8) `12-melody-buzzer`(S9) `13-clap-dial`(S10) `14-light-sensor`(S11) `15-temp-humidity`(S12) `16-tilt-pir`(S13) `17-ultrasonic`(S14) `18-servo`(S15) `19-joystick`(S16) `20-keypad-ir`(S17) `21-oled`(S18) `22-rfid`(S19) `23-button-king`(S20) `24-interrupt`(S21). order 11~24. 각 챕터: 6~9단계(problem·analysis·predict·run·readcheck·mission·(debug)·design·reflect), 그림 4~6장, 원본 분석의 미션·디버깅 거리 사용, `track: sensor`, `label`.

## ③ 교과 융합 F4~F9 (② 뒤, 병렬)
`31-safe-fan`(F4) `32-smart-cane`(F5) `33-room-climate`(F6) `34-street-lamp`(F7) `35-random-hammer`(F8) `36-memory-game`(F9). order 31~36. 2부 구성 허용, `prerequisites`·`subjects`·`sdg`·`sessions`, 교과 융합 활동(원리 카드 + "교과에서 보기" 섹션은 body 에), 통합 평가형 미션.

## ④ 통신·앱 (③ 뒤)
- 웹서버 블록(장치 레지스트리 `wifi`·`web`): `WiFi 연결(SSID, 비밀번호)`·`AP 모드 시작`·`IP 주소`, `웹서버 시작`, `요청 받기`(반복 몸통: `for` 꼴로 `path`·`query` 변수 제공), `경로가 %1 이면`, `질의 값 %1`, `JSON 응답 { … }`, `페이지 응답(제목, 버튼들, 값들)`, `index.html 내주기`, `글 응답`. 생성 코드는 키트 2-2-05·07 꼴(`network`·`socket`), 보드 파일 올리기에 `index.html` 지원.
- `app` 단계 유형(보고서 9절): 화면 설계 → 약속표(코드에서 추출) → 프롬프트 템플릿 → 붙여넣기 검사(한 파일·외부 스크립트 없음·약속 주소 사용·크기) → `index.html` 보드 저장 → 읽기 체크.
- `25-web-led`(S22) `26-web-sensors`(S23).

## ⑤ 교과 융합 F10~F16 (④ 뒤, 병렬)
`37-mood-light`(F10, app) `38-disaster-alarm`(F11, app) `39-sensor-board`(F12, app) `40-crosswalk`(F13 통합 평가) `41-bomb-game`(F14) `42-runner-game`(F15) `43-chick`(F16). 차량 F17~19·캡스톤 양식은 구입·결정 뒤.

## 완료 조건
- 트랙 화면 두 탭, 슬라이드 내보내기, S1~S23·F1~F16 콘텐츠, 앱 단계. 단위·e2e 통과, 배포. 각 단계 끝에 선생님이 볼 수 있게 푸시.
