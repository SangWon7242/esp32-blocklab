# ESP32 블록랩 — 계획 12: 판정 품질 (규칙 유지 장치 → 주의·설명 관문 → 블록 구조 규칙)

> **For agentic workers:** superpowers:subagent-driven-development. 작업 1·2 병렬(worktree) → 머지 → 작업 3·4 병렬 → 머지.

**근거:** 2026-10-16 선생님 결정 — 미션 판정을 codeMatches 로 완화한 뒤(f6e639b·0450a57·739d043·5ec3966) 단점을 보완하는 순서 "5 → 3·4 → 1". 판정기 `src/track/judge.ts`, 규칙 스키마 `src/track/schema.ts` RuleSchema, 미션 화면 `src/app/track/steps/MissionStep.tsx`·`JudgePanel.tsx`·`DebugStep.tsx`, 완료 규칙 `src/track/completion.ts`(stepCompleted: mission 은 `passed === true`), 설정 `src/app/settings/settings.ts`(teacherMode), 검사 엔진 `src/lint/index.ts` `lint(json, map)` → `Issue{id, level, ko, en, blockId, line}`.

## Global Constraints
- 기존 규칙(codeMatches·pinIs·outputIncludes·maxBlocks·codeEquals)과 챕터 YAML 은 그대로 동작. 학생 말·되묻기 톤, shadcn/ui + lucide, 이모지·방향어 금지, 폰 폭 375px 가로 스크롤 없음.
- 커밋마다 `npm test`·`npx tsc -b --noEmit`·`npm run build`, 작업 끝에 관련 e2e. src/track 은 Blockly 를 import 하지 않는다(판정은 순수 함수).

## 작업 1 (항목 5): 규칙 유지 장치 + 짧은 규칙 표기
- `src/track/content.test.ts` 저장소 전체 보호 테스트: 모든 mission(+debug 증상·extra 성격의 mission)에서 `answerCode` 가 있으면 통과(이미 있음) **그리고 `code:`(시작 코드)가 있으면 적어도 한 규칙 실패** — 시작 코드가 이미 정답인 미션은 YAML 에 `startPasses: true` 를 적어 예외(스키마에 선택 키 추가, README 에 뜻 적기). 각 규칙의 fail 문장이 "정답을 말하지 않는 되묻기" 형식인지 간단 검사(물음표로 끝나거나 "…나요?" 포함).
- 새 규칙 종류(RuleSchema, judge.ts, README 규칙 표):
  - `hasLine: { text: "time.sleep(2)", inside?: "loop" | "def" | "if" | "top" }` — 정규화 코드에서 공백·따옴표 종류 차이를 무시하고 그 줄(앞뒤 공백 제외, 비교 전 `\s+`→한 칸, `'`→`"`)이 있는가; `inside` 는 그 줄이 속한 가장 가까운 블록 머리(`while`/`for` → loop, `def` → def, `if/elif/else` → if, 들여쓰기 0 → top)를 본다(들여쓰기로 판단).
  - `notHas: "time.sleep(2)"` — 같은 비교로 그 줄이 없어야 한다.
  - `order: ["led.value(1)", "time.sleep(2)"]` — 첫 등장 순서가 이 차례인가(각 항목 hasLine 비교).
  - `count: { text: "led.value(1)", max?: n, min?: n }`.
- 기존 YAML 의 읽기 어려운 부정 규칙(03·09·13·24 의 `(?<![\s\S])(?!…)` 꼴)을 `notHas` 로 바꾼다. 다른 규칙은 그대로.
- 테스트: judge.test.ts 에 새 규칙 각각 통과/실패, inside 판별, 따옴표·공백 무시.

## 작업 2 (항목 3): 통과와 주의 분리
- 미션·디버깅 판정이 **통과**했을 때 `lint(program.blocksJson, map)` 을 돌려(코드 모드는 `codeToBlocks` 결과 json; map 은 `workspaceJsonToCodeWithMap` 로) level 이 warning 인 Issue 들을 `JudgePanel` 아래 "주의 (통과에는 영향 없음)" 목록으로 보여 준다(ko 문장, lucide `TriangleAlert`). 추가 주의 두 가지는 판정기 쪽 순수 함수 `src/track/notes.ts` 로: `unusedSetup`(준비한 장치 변수를 본문에서 안 씀), `leftoverFromStart`(시작 코드 `code:` 에만 있고 지시문이 바꾸라고 한 줄이 그대로 남음 — 규칙 `notHas` 가 없을 때만, 시작 코드와 비교해 "그대로 남은 줄 수 ≥ 전체의 90%" 면 "거의 바꾸지 않았어요" 주의).
- 주의는 완료를 막지 않는다. MissionInput·DebugInput 에 `notes?: string[]` 저장(판정 때). 테스트: notes.ts 단위, MissionStep 렌더(기존 테스트 방식 따라).

## 작업 3 (항목 4): 1분 설명 관문
- 설정 `explainGate: boolean`(기본 false, 설정 화면 교사 영역에 토글 "미션은 교사 확인 뒤 완료"). 켜져 있으면 mission·debug 의 완료 조건이 `passed && explained === true`. `MissionInput.explained?: boolean`.
- 화면: 통과 뒤 JudgePanel 의 통과 문구가 "통과했어요. 선생님께 1분 설명을 하고 확인을 받아요" 로 바뀌고, 교사 모드일 때만 보이는 버튼 "설명 확인"(lucide `BadgeCheck`) 을 누르면 `explained: true`. 교사 모드가 아니면 "선생님 확인 대기" 배지. 챕터 단계 목록·StepPage 상태(stepStates)도 "확인 대기" 를 구분(아이콘만, 글 짧게).
- 테스트: completion.test(게이트 on/off), e2e 1건(설정 켜고 → 판정 통과 → 완료 안 됨 → 교사 모드 확인 → 완료).

## 작업 4 (항목 1): 블록 구조 규칙
- 새 규칙 `blocks:`(RuleSchema): `{ blocks: { type: "esp_pin_write", fields?: { VALUE: "1" }, inside?: "flow_repeat_forever" | "<블록 타입>" | "loop" | "def", after?: { type, fields? } }, fail }` — 작업판 JSON(코드 모드는 MissionStep 이 `codeToBlocks(code).json` 을 넘긴다; 이미 `blocksJson` 입력이 있음)에서 그런 블록이 있는가. `inside` 는 조상 중 그 타입(loop = flow_repeat_forever·flow_repeat_n·flow_for_*·controls_whileUntil, def = procedures_*), `after` 는 같은 몸통에서 바로 앞 형제 블록. 값 입력은 `inputs: { SEC: { type: "math_number", fields: { NUM: "2" } } }` 꼴로 중첩 지정. 변수 필드는 이름으로 비교(VAR id 가 아니라 `fields.VAR.name`).
- MissionStep·DebugStep: 코드 모드에서 blocksJson 이 비면 `codeToBlocks(code)` 로 채워 judge 에 넘긴다(한 곳 `src/app/track/judgeInput.ts` 로 묶기).
- 본보기로 01-led 미션과 11-button-touch 미션을 `blocks` 규칙으로 다시 쓴다(기존 codeMatches 는 지우고, 정답/시작/변형 검증). README 규칙 표·블록 사전은 변화 없음.
- 테스트: judge.test(블록 규칙 통과/실패/inside/after/inputs), content.test 는 그대로 보호.

## 완료 조건
전부 머지·푸시·배포. 규칙 종류 표가 src/track/README.md 에 모두 있고, 보호 테스트가 모든 챕터를 덮는다.
