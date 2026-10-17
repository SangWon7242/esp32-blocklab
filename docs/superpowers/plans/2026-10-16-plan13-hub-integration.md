# 계획 13: dlab-learning-hub 통합 — 파이썬 AIoT 갤러리 수업

> **For agentic workers:** superpowers:subagent-driven-development. 두 저장소: 블록랩 worktree `/Users/lucas/works/python_projects/esp32-blocklab-wt-hub`(브랜치 `hub-library`), 허브 worktree `/Users/lucas/works/nextjs_projects/dlab-learning-hub-wt-aiot`(브랜치 `aiot-lessons`, `.env.local` 은 개발 DB). main 에는 선생님 승인 전 반영하지 않는다. push 금지.

**Spec:** `docs/superpowers/specs/2026-10-16-hub-integration-design.md`(허브 복사본 `docs/superpowers/specs/2026-10-16-python-aiot-integration-design.md`). 허브 탐색: `esp32-blocklab/.superpowers/sdd/hub-integration/hub-exploration.md`.

## Global Constraints
- 블록랩: 기존 테스트(1731)·체험판 e2e 유지, src/track 은 Blockly 를 import 하지 않음, 한국어 학생 말·되묻기, shadcn+lucide, 이모지·방향어 금지, `npm test`·`npx tsc -b --noEmit`·`npm run build` 통과.
- 허브: AGENTS.md(Next 16 문서 먼저 읽기), 관리자 API `authorizeAdminRequest`·페이지 `requireAdminPage("lessons")`, 학생 API `authorizeStudentRequest`/`authorizeLessonStudent`, 새 표는 anon/authenticated 권한 회수 + RLS 켬(`supabase/migrations/rls.test.ts` 가 지킴), AI 는 서버에서 `createAIProvider("openai")` 로 요청당 1회·실패가 저장을 막지 않음, 주석은 한국어 산문, 모바일 390px 가드, `pnpm test`·`pnpm lint`·`pnpm typecheck`·`pnpm build`·`pnpm test:e2e` 통과. 마이그레이션은 개발 DB 에만 `supabase db push`(운영 ref 금지 — config.ts 가 막음).
- 비밀값(키·토큰)을 어떤 파일·보고서에도 적지 않는다.

## 인터페이스 계약 (A 와 B 가 동시에 이 계약으로 일한다)
블록랩 `src/lib/index.ts` 내보내기:
```ts
export type HostUser = { id: string; name: string; grade?: string | null };
export type HostMode = "student" | "review" | "demo";
export type SettingsSource = { teacherMode: boolean; fakeBoard: boolean; explainGate: boolean };
export type AiClient = { reflect(req: ReflectRequest): Promise<AiReview>; debug(req: DebugRequest): Promise<AiReview> }; // src/ai/claude.ts 의 타입 재사용
export type Navigator = { href: { track(): string; chapter(id: string): string; step(id: string, step: string): string; lab(): string }; go(href: string): void };
export type HostProps = { user: HostUser | null; mode: HostMode; store: ProgressStore; settings: SettingsSource; ai?: AiClient; nav: Navigator; onSubmit?: (chapterId: string, snapshot: ChapterSnapshot) => Promise<void>; onSaveProject?: (p: { title: string; code: string; blocksJson: unknown; chapterId?: string }) => Promise<void>; reviewRecords?: Record<string, StepRecord> /* review 모드에서 보여 줄 학생 기록 */ };
export function BlocklabProvider(props: HostProps & { children: ReactNode }): JSX.Element;
export function TrackListView(): JSX.Element; export function ChapterView(p: { chapterId: string }): JSX.Element; export function StepView(p: { chapterId: string; stepId: string }): JSX.Element; export function LabView(): JSX.Element;
export function ChapterReviewView(p: { chapterId: string; records: Record<string, StepRecord> }): JSX.Element; export function ProjectPreview(p: { code: string; blocksJson?: unknown }): JSX.Element;
export type ChapterSnapshot = { chapterId: string; takenAt: string; records: Record<string, StepRecord>; programs: { stepId: string; code: string }[] };
export function chapterSnapshot(progress: Progress, chapterId: string): ChapterSnapshot;
export type TextAnswer = { stepId: string; stepType: string; title: string; prompt: string; answer: string };
export function textAnswersOf(chapter: Chapter, snapshot: ChapterSnapshot): TextAnswer[];
export type JudgeSummary = { steps: { stepId: string; type: string; passed: boolean | null; failures: string[]; notes: string[] }[]; missions: number; passed: number };
export function judgeSnapshot(chapter: LoadedChapter, snapshot: ChapterSnapshot): JudgeSummary; // 서버(Node)에서도 동작: Blockly 없이 judge + codeToBlocks
export { loadChapters, type LoadedChapter, type Chapter, type StepRecord, type Progress, type ProgressStore, judge, codeToBlocks };
export const LIB_VERSION: string;
```
CSS: `dist-lib/style.css` 는 `.blocklab` 아래에서만 작동. 호스트가 루트 `<div className="blocklab">` 를 감싼다(Provider 가 감쌈).

## A. 블록랩 라이브러리화 (worktree esp32-blocklab-wt-hub)
### A1. 호스트 어댑터·Provider·Navigator (한 에이전트)
- `src/host/HostContext.tsx`: `BlocklabProvider` + `useHost()`. `progressState.ts` 의 `progressStore` 싱글턴·`useProgress`·`saveStepRecord` 를 컨텍스트의 store 로 바꾸고, `useSettings()` 를 `useHost().settings` 로 위임(체험판은 기존 localStorage 설정 소스를 어댑터로). `AiCheck.tsx` 는 `useHost().ai` 가 없으면 버튼 숨김.
- `react-router` 제거: `src/app/**` 의 `Link/useNavigate/useParams` 를 `nav.href.*`·`nav.go` 와 props 기반 id 전달로 바꾼다(라이브러리 컴포넌트는 id 를 props 로 받음). 체험판 `App.tsx` 만 react-router 를 쓰고 `Navigator` 어댑터로 감싼다.
- `mode: "review"`: StepPage·ChapterPage 가 `reviewRecords` 를 쓰고(저장 안 함) 모든 단계 열림, 입력·판정·저장·제출·AI 버튼 숨김, 상단에 "열람 모드" 배지.
- 테스트: 컨텍스트 없을 때 명확한 오류, review 모드 렌더(react-dom/server), 체험판 e2e 그대로 통과. 커밋 "호스트 어댑터: Provider·Navigator·review 모드".
### A2. 제출 카드·스냅샷·판정 요약 (A1 뒤)
- `src/track/snapshot.ts`: `chapterSnapshot`, `textAnswersOf`(문제·조건 분석·예측·디버깅 설명·설계 빈칸·성찰·줄 설명·1분 설명 메모), `judgeSnapshot`(mission·debug·design 의 저장된 프로그램을 `judge` 로 다시 판정; Blockly 없이 동작 — src/track 규칙 준수). 단위 테스트(01-led 정답 기록으로 missions/passed, 글 답 추출).
- `src/app/track/SubmitCard.tsx`: 챕터의 필수 단계가 모두 완료(explainGate 포함)일 때 ChapterPage 하단에 "제출" 카드(제출 뒤 "다시 제출", 제출 중 상태, 실패 문구). `onSubmit` 없으면 숨김. 테스트.
- `ChapterReviewView`, `ProjectPreview`(코드 + 블록 그림 `renderBlockSvg` 재사용). 커밋 "제출 카드·스냅샷·열람 화면".
### A3. 라이브러리 빌드·CSS 범위·체험판 연결 (A1 뒤, A2 와 병렬)
- `src/lib/index.ts`(계약 그대로), `vite.lib.config.ts`(lib ESM, external react/react-dom/jsx-runtime, `cssCodeSplit:false`, 출력 `dist-lib/`), `package.json` `build:lib`·`exports`·`version` 연동(`LIB_VERSION`).
- CSS 범위: `src/index.css` 의 토큰을 `.blocklab` 에 두고 `@import "tailwindcss" important?` 대신 Tailwind 4 `@config`/`@source` + PostCSS 플러그인(`postcss-prefix-selector` 또는 자체 플러그인)으로 유틸·컴포넌트 선택자를 `.blocklab` 아래로 감싼다. 호스트 토큰 상속: `.blocklab { --primary: var(--host-primary, <기본>) }` 꼴로 shadcn 토큰 전부. Blockly 주입 CSS(body 레벨)는 그대로.
- 체험판 `src/main.tsx`: `BlocklabProvider` + `LocalProgressStore` + localStorage 설정 + Claude `AiClient` + react-router Navigator. `npm run build`(체험판)·`npm run build:lib` 둘 다 통과, `dist-lib/index.js` 가 `window` 없는 Node 에서 import 가능한지(순수 API 만) 테스트. 커밋 "라이브러리 빌드·CSS 범위". 태그 `lib-v1.0.0`(push 안 함).

## B. 허브 기반 (worktree dlab-learning-hub-wt-aiot; A 와 병렬 시작 가능)
### B1. 마이그레이션·시드·RLS (한 에이전트)
- `supabase/migrations/20261017000100_aiot_tables.sql`: `lesson_activities.kind` CHECK 에 'blocklab' 추가(drop/add constraint), `aiot_progress`, `aiot_lab_projects`, `aiot_project_shares`, `aiot_submissions`(스펙 4절 그대로), `students.school_grade text`, 모두 RLS 켬 + anon/authenticated revoke, updated_at 트리거. `supabase/migrations/aiot-rls.test.ts`(기존 algorithm-*-rls.test.ts 꼴).
- `src/lib/lessons/content/python-aiot.ts`: 과목·39 챕터·활동(kind blocklab, content {chapterId, track, label}) — 챕터 목록은 블록랩 `content/chapters/*/chapter.yaml` 의 id·order·title·summary·track·label 을 읽어 **생성 스크립트**(`scripts/aiot-chapters-from-blocklab.mjs <blocklab path>`)로 만들고 결과 TS 를 커밋. `seed-sql.ts` 에 `buildPythonAiotSeedSql` + 파일 `20261017000200_lesson_seed_python_aiot.sql`, `seed-sync.test.ts` 확장.
- `src/lib/lessons/types.ts`: `ActivityKind = "worksheet" | "blocklab"`, `BlocklabContent`. 기존 워크시트 코드가 kind 를 가정하는 곳(student-queries·views·admin-queries)이 blocklab 을 안전히 지나가게(카드 href 를 `/student/lessons/python-aiot/<chapterId>` 로).
- 개발 DB 적용: `supabase link --project-ref $(grep SUPABASE_PROJECT_REF .env.local)` 뒤 `supabase db push`, `supabase migration list` 로 확인(보고서에 결과만, ref 전체 적지 않음).
### B2. vendor·골격 화면·진행 API (A3 산출물 필요)
- `scripts/vendor-blocklab.mjs <blocklab repo> <tag>`: 그 worktree 에서 `npm run build:lib` 결과 `dist-lib/` 를 `vendor/blocklab/` 로 복사(이전 판 삭제), `vendor/blocklab/VERSION`. `tsconfig.json` paths `"@blocklab": ["./vendor/blocklab/index.js"]`, `"@blocklab/style.css"`. `next.config.ts` 에 필요하면 `transpilePackages` 없이(ESM 그대로), 라이브러리가 쓰는 React 는 허브 것 하나만(중복 React 검사 테스트).
- `src/lib/aiot/`: `progress-store.ts`(서버 조회/저장), `types.ts`. API: `GET/PUT /api/student/aiot/progress/[chapterId]`(PUT body {records, baseUpdatedAt} — 다르면 409 + 최신 반환).
- `src/components/aiot/BlocklabHost.tsx`("use client", `dynamic(() => import("@blocklab"), { ssr:false })`, `HubProgressStore`(fetch, 2초 디바운스, 409 면 서버 것으로 되돌리고 토스트), `HubNavigator`(next/navigation), 설정: 학생 {teacherMode:false, fakeBoard: 쿼리 `?device=fake` 또는 학생 설정, explainGate: 과목 설정값(기본 false)}, 관리자 열람은 mode review).
- 페이지: `/student/lessons/python-aiot/page.tsx`(두 트랙 탭 챕터 목록 — 블록랩 `TrackListView` 대신 허브 LessonCard 로 lesson_chapters 를 그림, 진행률은 aiot_progress 로), `/[chapterId]/page.tsx`(ChapterView 전체 화면), `/[chapterId]/[stepId]/page.tsx`(StepView). 접근은 `student-access.ts` 의 과목 연결 규칙 그대로.
- 테스트: API 권한·409, 페이지 렌더(jsdom 스모크), e2e fixture `/e2e-fixture/aiot-chapter`(가짜 보드, LocalProgressStore 어댑터로 DB 없이) 모바일·데스크톱. 커밋 "파이썬 AIoT 골격: vendor·진행 저장·챕터 화면".

## C. 제출·AI 피드백·관리자 (B2 뒤)
### C1. 제출 API + 서버 판정 + AI 피드백
- `POST /api/student/aiot/submissions` {chapterId, snapshot}: 서버가 `judgeSnapshot`(vendor 순수 API) 로 result 재계산 → `aiot_submissions` version+1 저장(feedback_status pending) → `src/lib/aiot/ai-feedback.ts`(`buildFeedbackPrompt(textAnswers, result, chapter, gradeBand)`, 학년대 VOICE 3종, JSON 파싱 `ai-json.ts` 재사용, 예산 3000) 1회 호출 → ready/failed. `GET /api/student/aiot/submissions?chapter=`. 학년대: `students.school_grade` → 과정 `recommended_grade` → "초5~6".
- `POST /api/student/aiot/ai` {kind: reflect|debug, …}: 블록랩 AiReview 꼴로 응답(프롬프트는 블록랩 `src/ai/claude.ts` 의 메시지 함수를 vendor 에서 import 해 재사용, 모델은 허브).
- 테스트: 프롬프트 스냅샷, 파싱 실패 → failed, 권한, 버전 증가.
### C2. 학생 제출 화면·코멘트
- ChapterView 아래 `SubmitCard` 연결(`onSubmit` → API), 제출 뒤 `FeedbackCard`(단계별 mark·praise·nextQuestion, 총평) + 기존 `ChapterComment`(lesson_comments, chapter_id = `aiot-<chapterId>`). 자동 새로고침으로 pending → ready.
### C3. 관리자
- `/admin/lessons/python-aiot/students/[studentId]/[chapterId]/page.tsx`: 제출 버전 선택, `ChapterReviewView`(review 모드, 학생 records), 규칙 결과 표, AI 피드백(forTeacher 포함)·"다시 생성"(`POST /api/admin/aiot/submissions/[id]/feedback/regenerate`), 코멘트 편집·보내기(기존 API). `/admin/lessons/python-aiot/preview/[chapterId]/[[...step]]/page.tsx`: 모든 단계 열람(review, records 없음). 관리자 목록 화면에서 kind blocklab 챕터 카드가 이 경로로. 학생 관리 화면에 `school_grade` 입력(기존 학생 편집 폼에 한 칸). 테스트: 권한, 렌더.

## D. 마이 페이지·작품·공유·성장 리포트 (C 와 병렬 가능 부분은 D1)
### D1. 작품 API·마이 페이지·자유 코딩
- `/api/student/aiot/projects` CRUD, `/api/student/aiot/projects/[id]/share` POST(토큰 발급: `growth-report-share.ts` 의 봉인 방식 재사용, `aiot_project_shares`), `/share/aiot/[token]/page.tsx`(공개, noindex, `ProjectPreview`, 학생 이름 없음; proxy 매처에 `/share/` 예외).
- `/student/lessons/python-aiot/my/page.tsx`: 작품 목록(열기→lab 에 불러오기, 공유 링크 복사(sonner 토스트), 삭제 확인), 제출 목록(챕터·버전·총평·코멘트), `/student/lessons/python-aiot/lab/page.tsx`(LabView, `onSaveProject`).
### D2. 성장 리포트 근거
- `growth-evidence.ts` 에 aiot 제출(기간 내 version 최신)·작품 수 요약 줄 추가(기존 markdown 꼴 유지), 테스트.

## E. 마감
- `Permissions-Policy` 에 `serial=(self)`(security-headers.test 갱신), CSP 에 unsafe-eval 없이 블록랩 e2e 통과 확인, 390px 가드, `pnpm lint/typecheck/build/test/test:e2e`, 블록랩 `npm test/build/build:lib`.
- 개발 DB 실사용 점검 체크리스트(스펙 9절) 수행 결과를 보고서로. 선생님 승인 뒤: 두 브랜치 main 머지·푸시, 운영 DB 적용은 별도 승인.
