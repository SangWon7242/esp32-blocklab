# 계획 14: 파이썬 AIoT 대화형 문제 해결 코치 — 첫 적용(S11)

> **For agentic workers:** superpowers:subagent-driven-development. 설계: `docs/superpowers/specs/2026-10-26-aiot-dialog-coach-design.md`(이하 "설계"). 원장: `.superpowers/sdd/2026-10-26-plan14/progress.md`.

## 선생님 결정 (2026-10-26)
1. **자리**: S11(`14-light-sensor`) 챕터 화면에 「코치로 하기」 를 기존 단계 흐름 옆에 나란히 둔다. 코치 설정 `enabled` 인 챕터만 보인다. 다른 챕터·기존 흐름은 바꾸지 않는다.
2. **코드 도움**: 기본 수준 2(뼈대 + 핵심 조건 빈칸). 챕터별 상한 `code_help_max`(1~3, 기본 2)는 선생님이 정한다.
3. **보드 증거**: 기본은 ⑦ 문을 실제 보드 증거(board-output 또는 board-observed)가 있어야 연다. 챕터 설정 `allow_no_board` 가 켜졌을 때만 가짜 보드 + 학생 보고로 연다(“보드로 확인하지 못함” 꼬리표).
- 나머지 미결정은 설계의 추천안을 따른다.
  - 코치 AI effort 는 low.
  - 학생 하루 120턴.
  - 편집기 원문은 **코치 표의 `editor` 칸**(블록랩 records 와 분리).
  - 선생님 체험은 화면만 보이고 AI·저장은 없다.
  - 정답 번들 문제는 이번 범위 밖이다.
  - 선생님 부르기는 관리자 화면 표시만 한다.

## 작업 위치
- **블록랩**: `/Users/lucas/works/python_projects/esp32-blocklab` main(e5d1b58, lib-v1.0.8).
  - 태그 `lib-v1.1.0` 을 만든다. push 는 선생님 승인 뒤에 한다.
- **허브**: `origin/main` 에서 딴 worktree `/Users/lucas/works/nextjs_projects/dlab-learning-hub-wt-coach`, 브랜치 `feat/aiot-coach`.
  - 본 폴더는 다른 세션이 쓰므로 건드리지 않는다.
  - 운영 반영은 PR 로 하고 선생님 승인 뒤에 한다.
- **DB**: 개발 프로젝트에만 적용한다(Supabase MCP `apply_migration`, 개발 프로젝트 = 이름에 `-prod` 가 없는 쪽). 운영은 승인 뒤.

## 인터페이스 계약 (A 와 B 가 동시에 이 계약으로 일한다)

### 블록랩 lib-v1.1.0 — `@blocklab` 에서 내보내는 것
```ts
export type CoachProgram = { code: string; blocksJson: unknown | null; parseError: boolean };
export type CoachProposal = { id: string; code: string; note?: string };
export type CoachRunEvent = {
  source: "board" | "fake"; ok: boolean;
  error?: { line?: number; message: string };
  output: string;          // 마지막 4096자
  code: string;            // 실행한 코드
  at: string;              // ISO
};
export type CoachEditorViewProps = {
  initialProgram?: { code: string; blocksJson?: unknown | null } | null; // 처음 한 번만 싣는다
  onProgramChange?: (p: CoachProgram) => void;                           // 편집 뒤 1초 디바운스
  proposal?: CoachProposal | null;                                        // 있으면 차이(diff) 상자
  onProposalDecision?: (id: string, accepted: boolean, program: CoachProgram) => void; // 적용하면 편집기에 넣은 뒤의 프로그램
  onRunEnd?: (e: CoachRunEvent) => void;
  highlightLines?: { start: number; end: number } | null;                // 1부터, 코드 칸 강조
  readOnly?: boolean;
};
export function CoachEditorView(p: CoachEditorViewProps): JSX.Element; // BlocklabProvider 안에서 쓴다(settings.fakeBoard 등)
```
- 편집기는 LabView 와 같은 편집기·보드 연결을 쓴다(블록·코드 탭, 보드 연결·실행·멈춤, 콘솔, 코드 글자 크기).
- 저장(작품 저장)·예제 불러오기 단추는 없다.
- **proposal 의 code 는 편집기 전체를 바꿀 새 코드**다. 상자는 지금 코드와의 줄 차이(추가/삭제 색, 줄 번호)를 보여 준다. 「적용」 을 누르면 편집기를 그 코드로 바꾸고(codeToBlocks 로 블록도), 「닫기」 를 누르면 그대로 둔다.
  - 둘 다 onProposalDecision 을 부른다. 자동으로 덮어쓰지 않는다.
  - 적용한 코드가 블록으로 바뀌지 않으면 코드 모드로 둔다.
- onRunEnd 는 실행이 끝날 때마다(성공·오류·멈춤) 부른다. 가짜 보드면 source "fake" 다.

### 허브 — 표 (설계 6.2, 바뀐 점만)
- `aiot_coach_sessions` 에 `editor jsonb`(`{code, blocksJson, versionId}`)를 더한다.
- 다른 표는 설계 그대로다: `aiot_coach_messages`(client_id unique, reply_to unique where role='ai'), `aiot_coach_events`, `aiot_coach_settings`, `aiot_ai_usage`.
- 모두 RLS on, anon/authenticated revoke, service_role 만 쓴다. 개발 DB 의 S11 에 `aiot_coach_settings(enabled=true)` 한 줄을 시드한다(마이그레이션 안에서).

### 허브 — 학생 API (`/api/student/aiot/coach/[chapterId]/…`)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| GET `` | — | `{session:{stage, record, recordVersion, editor, flags}, messages: CoachMessage[], settings: StudentCoachSettings}` (세션 없으면 만들고 stage 1) |
| POST `/turn` | `{clientId, stage, text, kind?: "answer"|"question"|"hint"}` | 200 `{studentMessage, aiMessage, record, recordVersion}` · 503 `{studentMessage, retry:true}` · 409 단계 불일치 · 429 한도 |
| PATCH `/record` | `{recordVersion, ops: RecordOp[]}` | 200 `{record, recordVersion}` · 409 `{record, recordVersion}` |
| POST `/advance` | `{fromStage, recordVersion}` | 200 `{stage}` · 409 `{missing: string[]}` |
| POST `/evidence` | `{kind:"program", program:{code, blocksJson}}` 또는 `{kind:"run", run: CoachRunEvent}` | 200 `{record, recordVersion, editor}` |
| POST `/proposal-decision` | `{proposalId, accepted, program?}` | 200 |
| POST `/call-teacher` | `{note?}` | 200 |

`RecordOp = {op:"set"|"add"|"retire"|"confirm"|"edit", path: string, value?: unknown, id?: string}`. 학생 op 는 학생 원문(`student`) 또는 확인(`student-confirmed`)으로 기록한다.

### 허브 — 관리자 API
- `GET/PATCH /api/admin/aiot/coach/[studentId]/[chapterId]`(교사 수정 ops, `open`/`back` 단계, 한 줄 메시지, 막힘 해제)
- `GET/PUT /api/admin/aiot/coach-settings/[chapterId]`

## 단계
- **A. 블록랩 lib-v1.1.0** — CoachEditorView(+시험·체험판 e2e 확인용 숨은 경로), core 변화 없음, 태그.
- **B. 허브 코치 서버** — 마이그레이션(개발 DB), provider 확장(호출별 effort·usage 반환), `src/lib/aiot/coach/*`(record 꼴·op 적용·문 검사·영향 전파·기능 표식 해석·프롬프트·응답 검증·정답 유출 검사·사용량), 라우트, 시험. A 와 병렬.
- **C. 허브 학생 화면** — A·B 뒤. vendor lib-v1.1.0, 챕터 화면의 「코치로 하기」, 코치 화면(배치 A·B, 단계 띠, 카드, 대화, 편집기 다리, 시험 기록, 생각 바꾸기, 선생님 부르기, 이어하기, 재시도), e2e(가짜 AI).
- **D. 허브 교사 화면** — C 뒤. 반 보드 코치 열, 학생 상세 코치 탭(출처 배지·연결 그래프·대화·도움·증거), 개입, 설정 화면.
- **E. 점검** — 개발 DB 실사용(설계 9절 시나리오, 실제 AI 몇 턴), 전체 시험·빌드, 보고.
