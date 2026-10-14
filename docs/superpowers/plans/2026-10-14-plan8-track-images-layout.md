# ESP32 블록랩 — 계획 8: 트랙을 구체적으로 (그림·상황·할 일) + 공간을 채우는 레이아웃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 트랙 단계가 "무얼 하는지 감이 오게" 바뀐다. (1) 단계마다 **그림(SVG)** 과 **상황 설명·지금 할 일** 이 붙고, 질문·지시문은 학생 말로 구체적으로 바뀐다(선생님 수업 방식은 그대로: 문제 만나기 → 조건 분석 → 예측 → 실행 → 읽기 체크 → 미션·디버깅 → 설계 → 성찰). (2) 단계 화면과 챕터 화면이 빈 곳 없이 채워지되 활동 영역은 넉넉하고, 안내 칸은 접을 수 있어 유연하다.

**Architecture:** 콘텐츠 형식(`src/track/schema.ts`)에 `scene`(그림+설명)·`todo`(지금 할 일)·챕터 `cover`·`materials`(부품)·`wiring`(배선도)을 더하고, 그림은 `content/chapters/<id>/images/*.svg` 를 `import.meta.glob(…, { query: "?raw" })` 로 읽어 **인라인 SVG** 로 그린다(`currentColor`·CSS 변수로 다크 모드 대응, 크기 유연). 화면: `StepPage` 왼쪽 안내 칸 = 단계 배지 + 제목 + 장면 그림 + 상황 글 + "지금 할 일" 체크 카드 + (접힘) 부품·배선; 오른쪽 활동 = 유형별로 공간을 채우는 격자. 챕터 화면 = 표지 그림 + 목표 + 부품 칩 + 단계 카드 격자. 모든 글은 `GuideBody` 가 가벼운 markdown(굵게·목록·코드)으로 그린다.

**Spec:** 이 문서. 수업 자료(선생님 원본): `/Users/lucas/works/python_projects/python_esp32_project/챕터10-교사용지도안-110분.md`, `챕터10-학생용-트랙진행표.md`(챕터 10 글은 여기 표현을 따른다). 기준 문서 `docs/superpowers/specs/2026-10-13-esp32-blocklab-design.md` 8장(트랙).

## Global Constraints
- 선생님 수업 방식·단계 순서·판정 규칙·`id` 는 바꾸지 않는다(진행 기록 키). 글만 구체적으로 바꾼다.
- 그림은 **SVG 손그림**(lucide 느낌: 선 2px, 둥근 끝, 단순한 면 색). `viewBox="0 0 640 360"`(장면) 또는 정사각(부품). 선은 `currentColor`, 면 색은 프로젝트 팔레트(`src/blocks/colors.ts` 의 카테고리 색 또는 `var(--primary)` 등 CSS 변수) 소수만. 글자는 `<text>` 에 한국어, `font-family: inherit`, 12~16px. 사진처럼 그리려 하지 말고 **설명 그림**(배선도·원리도·장면 스케치)으로. 이모지 금지. 각 SVG 는 `role="img"` + `<title>` 설명.
- 학생 글: 중학생 말로, 상황(어디서·무엇이·왜) → 지금 할 일(1~3개) → 끝났는지 아는 법. 2~4문장 단락. 질문은 구체적 사물·숫자·핀 번호를 넣는다. 정답을 말하지 않는 되묻기 원칙 유지.
- lucide·shadcn 만. 반응형(폰 폭에서 한 열). 기존 e2e(`e2e/track*.spec.ts`)는 유형별 동작을 검사하므로 선택자(testid)를 유지한다. 커밋마다 `npm test`·tsc·build, 마지막에 `npm run test:e2e`.

## 사전 확인된 사실
- 형식: `src/track/schema.ts`(zod, `base` 에 `body`), 문서 `src/track/README.md`. 로더 `src/track/content.ts`(`LoadedChapter = Chapter & { files }`), 코드 파일은 `src/track/files.ts` 의 `import.meta.glob("/content/chapters/*/*.py", { query: "?raw" … })`. 챕터: `content/chapters/01-led/chapter.yaml`(8단계), `10-auto-door/chapter.yaml`(14단계, 2부). 챕터 10 에는 `goals`·`successCriteria` 가 이미 있다.
- 화면: `src/app/track/StepPage.tsx`(상단 바 + `lg:grid-cols-[2fr_3fr]`: `aside` 안내(제목·분·`GuideBody body`) / `section` 활동 + 하단 이전·다음), 유형 컴포넌트 `src/app/track/steps/*.tsx`(Problem: 질문별 Textarea; Analysis: 3열 Textarea + 예시 답; Predict; ReadCheck; RunStep·MissionStep·DebugStep·DesignStep: `TrackEditor`; Reflect; AiCheck), `ChapterPage.tsx`(`max-w-3xl`, 목표 dl, 단계 목록 세로), `TrackPage.tsx`(챕터 카드 2열), `GuideBody.tsx`(문단만).
- 설정의 교사 모드(`readSettings().teacherMode`)가 단계 잠금을 넘길 수 있는지 `src/track/gating.ts`·`StepPage` 에서 확인(검증용).

## Task 1: 형식·로더·그림 렌더 + 안내 칸 뼈대
- [ ] `schema.ts`: `base` 에 `scene?: { image: string; caption?: string }`, `todo?: string[]`(1~4), `body` 는 그대로(markdown 확장). 챕터에 `cover?: string`, `summary?: string`, `materials?: { name: string; image?: string; note?: string }[]`, `wiring?: { image: string; caption?: string }`. `image` 는 `images/<file>.svg`.
- [ ] `src/track/images.ts`: `import.meta.glob("/content/chapters/*/images/*.svg", { query: "?raw", import: "default", eager: true })` → `chapterImage(chapterId, ref): string | undefined`. 테스트: 참조된 모든 이미지가 존재한다(content.test 에 추가), SVG 에 `<script` 없음.
- [ ] `src/app/track/Illustration.tsx`: 인라인 SVG(`dangerouslySetInnerHTML` 은 우리 파일만이므로 허용하되 `<script` 를 거른 문자열만), `className` 으로 크기, `figcaption`. 
- [ ] `GuideBody`: 가벼운 markdown — 문단, `**굵게**`, `- 목록`, `` `코드` ``, `1. 번호`. 테스트.
- [ ] `StepPage` 안내 칸: 배지·제목 → `scene` 그림(있으면) → `body` → "지금 할 일" 카드(`todo`, 체크 표시는 장식, 완료 조건은 기존 로직) → 접힘(`Collapsible`) "부품과 배선"(챕터 `materials`·`wiring`). 안내 칸 접기 버튼(`PanelLeftClose`)으로 활동을 넓게; 상태는 localStorage. `README.md` 갱신.
- [ ] 커밋 "트랙 형식: 장면 그림·할 일·부품·배선, 안내 칸 markdown".

## Task 2: 챕터 1(LED) 그림과 글
- [ ] 그림 `content/chapters/01-led/images/`: `cover.svg`(교실 불 켜는 장면 또는 보드+LED 스케치), `wiring-led.svg`(ESP32 보드 윤곽·핀 번호 26·GND, LED 긴 다리(+)→저항 220Ω→26번, 짧은 다리→GND), `led-parts.svg`(LED 다리 길이·극성), `blink-timeline.svg`(켜짐 1초/꺼짐 1초 타임라인 막대), `sos.svg`(짧게·길게 패턴), `three-boxes.svg`(알아야 할 것/정해야 할 것/해야 할 것 세 칸).
- [ ] `chapter.yaml`: `summary`, `cover`, `materials`(ESP32 보드, LED, 220Ω 저항, 점퍼선, USB 선), `wiring`; 단계마다 `scene`·`body`·`todo`; 질문·지시문을 구체적으로(예: 문제 만나기 질문 "LED 긴 다리는 어느 핀에 꽂았나요? 그 번호가 코드 어디에 나올까요?"). 미션 `hint` 추가. 성찰 prompts 는 4개 유지.
- [ ] `npm test`(content 테스트가 그림 존재·형식 검사) → 커밋 "챕터 1: 그림과 구체적인 안내".

## Task 3: 챕터 10(자동문) 그림과 글
- [ ] 그림 `content/chapters/10-auto-door/images/`: `cover.svg`(백화점 자동문에 사람이 다가가는 장면, 문 위 센서 전파), `ultrasonic-principle.svg`(trig 펄스 → 벽 → echo, 거리 = 시간×340/2 ÷ 10000 cm), `wiring-ultrasonic.svg`(HC-SR04 VCC/GND/Trig 13/Echo 12), `wiring-door.svg`(서보 핀·OLED SDA 21/SCL 22 추가), `servo-door.svg`(서보 팔 0°→90°로 문 열림), `threshold.svg`(거리 30cm 기준선: 가까우면 열림/멀면 닫힘), `debug-flow.svg`(증상 → 어디부터 볼까 화살표).
- [ ] `chapter.yaml`: 지도안·학생용 진행표의 표현으로 `summary`·`cover`·`materials`·`wiring`, 14단계 `scene`·`body`·`todo`, 질문·지시문 구체화. 디버깅 증상 글은 학생 말(예: "숫자가 계속 0만 나와요 — echo 선이 빠졌을 때").
- [ ] 커밋 "챕터 10: 그림과 구체적인 안내".

## Task 4: 공간을 채우는 레이아웃
- [ ] `StepPage`: 넓은 화면 `grid-cols-[minmax(320px,2fr)_minmax(0,3fr)]`, 안내 칸 접으면 활동 전폭. 활동 `section` 은 세로로 꽉 차게(`flex flex-col`, 편집기 단계는 `h-full`).
- [ ] 입력형 단계 밀도: `Problem` 질문 카드 2열(넓은 화면)·각 카드에 "예: …" 힌트 placeholder(콘텐츠 `questions` 는 문자열 유지, 힌트는 `scene.caption`/`todo` 로 충분하면 생략); `Predict`·`ReadCheck` 는 코드(읽기 전용)와 문항을 좌우 2열; `Reflect` 는 prompts 2×2 격자; `Analysis` 는 3열 유지 + 세 칸 그림(`three-boxes.svg`)을 위에.
- [ ] `ChapterPage`: `max-w-5xl`, 상단 hero(표지 그림 왼쪽 + 제목·목표·성공 기준 오른쪽), 부품 칩 줄, 단계는 2열 카드 격자(번호·유형·분·잠금/완료), 진행률.
- [ ] `TrackPage`: 챕터 카드에 표지 그림·요약·진행률.
- [ ] 폰 폭 확인(한 열, 가로 스크롤 없음). e2e: 기존 통과 + 안내 칸 접기 토글, 챕터 화면에 표지 그림(`svg[role=img]`).
- [ ] 커밋 "트랙 화면: 빈 곳 없이, 안내 칸 접기, 챕터 hero·카드 격자", 푸시, 배포 확인.

## 완료 조건
- 두 챕터 모든 단계에 장면 그림·상황 글·할 일이 있고, 챕터 화면에 표지·부품·배선이 있다. 단위·e2e 통과, 배포.
