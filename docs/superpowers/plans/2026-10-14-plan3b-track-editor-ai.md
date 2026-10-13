# ESP32 블록랩 — 계획 3B: 트랙 편집기형 단계와 AI 점검

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 트랙의 실행·미션·디버깅·설계(조립) 단계를 실제 편집기와 판정으로 연결하고, 교사 키로 AI 설명 점검을 붙인다. 기준 문서 §8.2(run/mission/debug/design 행)·§8.4·§10.

**Architecture:** 자유 코딩 화면의 편집기 부품(`BlocklyWorkspace`, `CodePanel`, `editorSync` 리듀서, `useLint`, `useDevice`)을 묶은 `TrackEditor` 컴포넌트를 만들어 단계 화면 오른쪽에 넣는다. 단계가 지정한 코드 파일을 초기 프로그램으로 싣고, "판정" 버튼이 `judge(rules, {code, blocksJson, output}, files)`를 돌려 실패 문장을 보여 준다. 디버깅 단계는 설명 글을 먼저 저장해야 편집기가 열린다. 설계 단계는 ①의사코드 빈칸 → ②번역표 → ③조립(기대 코드를 블록으로 바꾼 뒤 명령 블록을 흩어 놓고 학생이 잇는다; 판정은 `codeEquals`).

### Task 1: TrackEditor + run/mission/debug 단계
- `src/app/track/TrackEditor.tsx`: props `{ initialCode, onProgram(code, blocksJson), compact?: boolean }` — 블록/코드 탭, 작업판, 코드 패널, 보드 버튼(연결·실행·멈춤; "보드에 저장"은 숨김), 콘솔(접힘). 실행 출력은 `onOutput(text)`로 올려 `outputIncludes` 판정에 쓴다. 저장: 단계 기록에 `{ code, blocksJson }`을 디바운스(1초)로 저장하고 다시 열면 복원.
- run 단계: 지정 코드가 실려 있고, "실행" 성공(FakeDevice 포함) 1회면 완료(장치 `run()`이 `ok`를 돌려줄 때 기록).
- mission 단계: 지시문·힌트(힌트는 **판정 실패 뒤에만** 보임)·편집기·"판정" 버튼. 통과 시 완료 가능; 실패 시 규칙의 `fail` 문장 목록(정답 안 말함). 교사 모드에서는 `answerCode` 열기 버튼.
- debug 단계: 증상 카드(제목·고장 코드·되묻기) → "왜 이런 증상일까?" 설명 textarea 저장 전에는 편집기 잠김(잠금 안내) → 저장 뒤 편집기(고장 코드 실림) + 판정. 모든 증상 통과 시 완료.
- `?device=fake`/설정 가짜 보드 존중. e2e 3개(가짜 보드): run 완료, mission 실패→힌트→통과, debug 설명 전 잠김→설명→통과.

### Task 2: design(Parsons) 단계와 AI 점검
- design: ①빈칸(`blank.answer`와 `tolerance`로 채점, 숫자는 범위) → ②번역표 → ③조립 작업판(`codeToBlocks(targetCode)`의 start 몸통 명령 블록들을 분리해 무작위 위치에 두고 시작 블록만 고정) → "판정"(`codeEquals` targetCode). 완료 조건 §8.2.
- AI 점검(§10): 설정에 교사용 Claude API 키·모델(`claude-sonnet-5-5`), `src/ai/`(fetch, 프롬프트, JSON 응답 스키마), reflect 단계 "내 설명 점검 받기", debug 단계 "질문 3개만 받기"; 키 없으면 버튼 숨김; 응답은 단계 기록에 저장.
