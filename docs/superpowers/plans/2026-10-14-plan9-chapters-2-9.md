# ESP32 블록랩 — 계획 9: 챕터 2~9 트랙 콘텐츠

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. 챕터마다 한 작업(폴더가 서로 다르므로 병렬 가능).

**Goal:** 수업 코드 저장소(`https://github.com/SangWon7242/esp32-micropython-class`, 로컬 사본 `<scratchpad>/classrepo/`)의 2~9장을 사이트 트랙(`content/chapters/<id>/chapter.yaml` + 코드 파일 + `images/*.svg`)으로 옮긴다. 1장(`01-led`)·10장(`10-auto-door`)과 같은 형태: 8단계 사고 활동 + 장면 그림 + 상황 설명 + 지금 할 일 + 브레드보드 배선도.

**Spec:** `docs/superpowers/plans/2026-10-14-plan8-track-images-layout.md`(그림·글 규칙), `src/track/README.md`(형식), 1·10장 yaml(본보기), 저장소 각 장 `README.md`(목표·준비물·연결표·코드 흐름·미션·체크포인트)와 `code/*.py`.

## Global Constraints
- 코드 파일은 저장소 원본을 **그대로** 복사한다(파일 이름 유지). 트랙 단계가 참조하는 파일은 `codeRefs` 검사에 걸린다.
- 단계 구성(한 챕터 8~12단계): `problem`(질문 2~3) → `analysis`(세 칸 예시 답) → `predict`(step1 코드, 빈칸 2~3) → `run`(step1) → `readcheck`(문항 3: number/choice/line, `line` 답은 파일 원문 줄 번호를 세어 정확히) → `mission`(저장소 mission_*.py 를 `codeEquals` 정답으로; `fail` 은 되묻기) → (코드가 둘 이상인 장은 `run`·`readcheck` 추가) → `design`(의사코드 빈칸 + 번역표 + `targetCode`) → `reflect`(prompts 정확히 4개, `lineExplain`). 디버깅(`debug`)은 저장소 README 의 "자주 나는 오류"가 있으면 증상 2~3개로.
- 모든 단계에 `scene`(그림+caption)·`body`(2~4문장, 학생 말, 방향어 금지: "오른쪽" 대신 "활동 칸")·`todo`(1~3). 챕터에 `summary`·`cover`·`goals`·`successCriteria`·`materials`(브레드보드 포함, 메모)·`wiring`.
- 그림: 표지, 브레드보드 배선도(부품을 브레드보드에 꽂고 ESP32 는 옆에; 선 색 빨강 전원·검정 GND·노랑/초록/파랑 신호; 핀 번호는 저장소 연결표 그대로), 원리/개념도 1~2장(예: PWM 듀티 파형, 리스트에서 하나씩 꺼내기, 74HC595 시프트, 모터 두 핀 조합 표, RFID 카드 UID 비교, I2C 공유 선), 세 칸 보드(`three-boxes.svg` 는 1장 것을 복사), 읽기용 코드 그림(답을 보여 주지 않게). 규칙은 계획 8과 같다(`currentColor`, 고유 id 접두사, `role="img"`+`<title>`, 640×360, 이모지 금지).
- 검사: `npm test`(content 검사: 형식·그림 존재·SVG 안전·코드 참조; `src/lint/chapters.test.ts` 가 챕터 코드를 검사하면 그 기준도), tsc, build. 각 챕터는 `git add content/chapters/<id>` 만으로 커밋(병렬 작업 충돌 방지).
- 장치 블록이 코드를 접지 못해 `code_stmt` 로 남는 줄이 있어도 괜찮다(미션 판정은 정규화 코드 비교). 단, `design.targetCode` 조립은 블록으로 되돌아가야 하므로 `codeToBlocks(targetCode)` 에 `code_stmt`/`code_expr` 가 없는 파일(또는 그 일부를 담은 별도 파일 `design_*.py`)을 고른다 — 안 되면 설계 단계의 `targetCode` 용 짧은 파일을 새로 만든다.

## 챕터 id 와 폴더
`02-breathing-led`, `03-traffic-light`, `04-flowing-light`, `05-rgb-led`, `06-seven-segment`, `07-fan`, `08-access-control`, `09-oled-access`. `order` 는 장 번호.

## Task N (N = 2..9): 챕터 N
- [ ] 저장소 `0N_*/README.md` 와 `code/` 전체를 읽고, 1·10장 yaml 을 본보기로 `chapter.yaml` 작성, 코드 복사, 그림 5~7장 제작.
- [ ] `npm test`·tsc·build 통과, 개발 서버에서 챕터 화면·단계 2개 이상 스크린샷(밝음·어두움·375px) 확인.
- [ ] 커밋 "챕터 N: <제목> 트랙".

## 완료 조건
- 트랙 목록에 1~10장이 순서대로 보이고, 모든 챕터가 콘텐츠 검사를 통과하며, 배포됨.
