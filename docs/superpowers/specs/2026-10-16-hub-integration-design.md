# ESP32 블록랩 → dlab-learning-hub 통합 설계 ("파이썬 AIoT" 갤러리 수업)

작성 2026-10-16. 결정(선생님): 라이브러리로 이식(iframe 아님, 허브 페이지가 직접 그림) · 규칙 채점 + AI 글 평가·피드백 · 자동 저장·이어하기 + 챕터 끝 제출 버튼 · 개발 DB 먼저, 운영은 승인 뒤 · 두 저장소 모두 별도 worktree/브랜치에서 작업하고 전부 통과한 뒤 main 반영.
허브 탐색 요약: `esp32-blocklab/.superpowers/sdd/hub-integration/hub-exploration.md`.

## 1. 목표와 범위
- 허브 학생 갤러리에 과목 **파이썬 AIoT** 가 "AI 엔트리 심화"와 같은 카드 형태로 들어가고, 챕터(S1~S23·F1~F16, 39개)를 열면 허브 페이지 안에서 블록랩 트랙 화면이 그려진다(허브 로그인·디자인 그대로).
- 진행은 학생 계정에 자동 저장되어 어디서든 이어서 하고, 챕터가 끝나면 학생이 **제출** 한다. 제출은 규칙 판정 결과 + AI 글 평가 피드백(학년 눈높이)이 붙고, 관리자는 제출을 보고 코멘트를 남긴다(AI 엔트리 심화의 `lesson_comments` 흐름 재사용).
- 관리자는 모든 챕터·단계를 잠금 없이 열람할 수 있지만 제출·저장은 못 한다(열람 모드).
- 학생은 수업 안 **마이 페이지**에서 저장한 코드(자유 코딩 작품 + 챕터 프로그램)와 제출·피드백을 보고, 작품마다 **공유 링크**를 복사할 수 있다.
- 제출·작품 요약은 **성장 리포트**의 수업 근거(`growth-evidence`)로 들어간다(발송은 기존 알림톡 흐름).
- 비범위: 실보드 WiFi 수업의 서버 측 시뮬레이션, 보호자 계정, 블록랩을 허브 소스로 옮기기, BLE·ESP-NOW, 운영 DB 자동 적용.

## 2. 전체 구조
```
esp32-blocklab (저장소 그대로, 브랜치 hub-library)
  src/lib/index.ts  ──vite lib build──▶  dist-lib/ (ESM + style.css)  ──scripts/vendor-blocklab.mjs──▶
dlab-learning-hub (브랜치 aiot-lessons)
  vendor/blocklab/<version>/  (커밋됨)  ◀── import "@blocklab/*" (tsconfig paths)
  src/app/student/lessons/python-aiot/...   학생 화면 (클라이언트 컴포넌트, dynamic import, ssr:false)
  src/app/admin/lessons/python-aiot/...     관리자 열람·제출 검토
  src/app/api/student/aiot/*, api/admin/aiot/*   진행·제출·AI·작품·공유
  supabase/migrations/2026101700xxxx_aiot_*.sql
```
- 허브는 블록랩의 **컴포넌트와 순수 함수**를 import 하고, 저장·AI·사용자·이동은 **어댑터**로 넘긴다. 블록랩 안에는 라우터·localStorage·API 키가 남지 않는다(체험판 빌드에서만 기존 구현을 어댑터로 감싼다).
- 배포 흐름: 블록랩 태그(`lib-v1.0.0`) → 허브에서 `pnpm blocklab:update ../esp32-blocklab lib-v1.0.0` → `vendor/blocklab/` 갱신 커밋 → Vercel 미리보기 → main. 빌드 산출물을 커밋하는 이유: Vercel 빌드가 다른 저장소를 받아 빌드할 필요가 없고(pyodide 복사와 같은 사고), 어떤 판이 운영 중인지 git 으로 남는다.

## 3. 블록랩 쪽 변경 (라이브러리 진입점)
`src/lib/index.ts` 가 내보내는 것:
- `BlocklabProvider` props: `{ user: { id, name, grade? } | null, mode: "student" | "review" | "demo", store: ProgressStore, settings: SettingsSource, ai?: AiClient, nav: Navigator, hostTheme?: "hub" }`.
  - `ProgressStore` 는 기존 인터페이스(`src/track/progress.ts`) 그대로. 허브는 `HubProgressStore`(fetch) 를 넘기고 체험판은 `LocalProgressStore`.
  - `SettingsSource`: teacherMode·fakeBoard·explainGate 를 호스트가 정함(허브: 관리자=teacherMode, 학생=설정 테이블 값). 블록랩 설정 화면은 라이브러리에 포함하지 않는다.
  - `AiClient`: `{ reflect(req): Promise<AiReview>, debug(req): Promise<AiReview> }` — 허브는 서버 API 로, 체험판은 기존 교사 키 Claude 호출로 구현.
  - `Navigator`: `{ toChapter(id), toStep(id, step), toTrack(), href(...) }` — react-router 의존 제거. 라이브러리 안 `<Link>` 는 `nav.href` 로 만든 `<a>` 또는 호스트 Link 컴포넌트 주입.
  - `mode: "review"`: 모든 단계 열림, 입력·판정·저장·제출 버튼 숨김(읽기 전용), 관리자가 학생 기록을 넘기면 그 기록을 보여 준다.
- 화면 컴포넌트: `TrackListView`, `ChapterView`, `StepView`, `LabView`(자유 코딩), `ChapterReviewView`(제출 스냅샷 읽기 전용), `ProjectPreview`(코드 + 블록 그림, 공유 페이지용).
- 순수 API: `loadChapters`, `judge`, `codeToBlocks`, `blocksToCode`, `canonicalLines`, `chapterSubmissionSnapshot(progress, chapter)`(제출용 스냅샷 만들기), `textAnswersOf(snapshot)`(AI 평가용 글 답 뽑기), `renderBlockSvg`.
- 제출 UI: 챕터의 모든 필수 단계가 끝나면 챕터 페이지에 **제출** 카드(블록랩 컴포넌트, 호스트가 `onSubmit(snapshot)` 을 넘김). 제출 뒤에도 고치면 "다시 제출" 가능. 체험판은 onSubmit 없음 → 카드 숨김.
- 스타일: 라이브러리 CSS 는 `.blocklab` 루트 아래로 범위를 한정(Tailwind 4 `@layer` + 접두사 없는 유틸을 루트 셀렉터로 감싸는 PostCSS 단계). 색 토큰은 호스트 토큰(`--primary` 등)이 있으면 그것을 쓰고 없으면 자기 값(체험판). 글꼴은 호스트를 따른다.
- Blockly·CodeMirror 는 라이브러리에 포함(허브가 따로 설치하지 않음). `window` 접근은 컴포넌트 안에서만.
- 빌드: `vite.lib.config.ts`(`build.lib`, external: react, react-dom, react/jsx-runtime), 결과 `dist-lib/{index.js, chunks/*.js, style.css, package.json(version)}`. 콘텐츠는 지금처럼 `import.meta.glob` 으로 번들에 포함.
- 체험판(GitHub Pages)은 `src/main.tsx` 가 `BlocklabProvider` 를 로컬 어댑터로 감싸는 것만 바뀜. 기존 테스트 전부 유지 + 라이브러리 진입점 테스트(모드·어댑터).

## 4. 허브 데이터 모델 (마이그레이션, 개발 DB 먼저)
- `lesson_activities.kind` CHECK 에 `'blocklab'` 추가. `content` = `{ "chapterId": "01-led", "track": "sensor", "label": "S1" }`.
- 시드(`src/lib/lessons/content/python-aiot.ts` → `pnpm lessons:seed`): `lesson_subjects` `python-aiot`(제목 "파이썬 AIoT", cover gradient·icon cpu), `lesson_chapters` 39개(id `aiot-<chapterId>`, 순서 = 블록랩 order, 두 트랙은 `kicker` 로 구분), 챕터마다 `lesson_activities` 1개(kind blocklab). 과정 연결(`lesson_subject_courses`)은 기존처럼 원장이 관리자 화면에서.
- 새 테이블(모두 anon/authenticated 권한 회수, service_role 만; RLS 테스트 추가):
  - `aiot_progress(student_id uuid, chapter_id text, records jsonb, updated_at)` PK(student, chapter) — 블록랩 `Progress.chapters[chapterId]` 한 칸. 자동 저장·이어하기.
  - `aiot_lab_projects(id uuid, student_id, title text, code text, blocks_json jsonb, source text check in ('lab','chapter'), chapter_id text null, created_at, updated_at)` — 마이 페이지 작품.
  - `aiot_project_shares(token_hash text pk, project_id uuid, created_at, expires_at null)` — 공유 링크(SHARE_LINK_KEY 로 봉인, 성장 리포트 공유와 같은 꼴; 만료 없음 기본, 관리자가 끄기 가능).
  - `aiot_submissions(id uuid, student_id, chapter_id, version int, snapshot jsonb, result jsonb, feedback jsonb null, feedback_status text check in ('pending','ready','failed'), submitted_at)` unique(student, chapter, version) — 다시 제출은 version+1. `lesson_attempts` 는 제출 잠금 트리거와 1건 제약이 있어 쓰지 않는다. 관리자 코멘트는 `lesson_comments`(학생×챕터) 재사용.
  - `students.school_grade text null`(예: "초4", "중2", "고1") — AI 눈높이. 관리자 학생 화면에서 입력. 없으면 과정의 `recommended_grade`, 그것도 없으면 "초5~6".
- 성장 리포트: `growth-evidence.ts` 에 aiot 제출 요약(챕터 제목·미션 통과 수·AI 총평 1줄·작품 수) 추가.

## 5. 허브 API
학생(`authorizeStudentRequest`): `GET/PUT /api/student/aiot/progress/[chapterId]`(자동 저장, 2초 디바운스, ETag 로 충돌 감지), `POST /api/student/aiot/submissions`(스냅샷 → 서버가 `judge` 로 결과 재계산 → 저장 → AI 피드백 1회 호출(실패해도 저장은 유지, status failed) ), `GET /api/student/aiot/submissions?chapter=`, `POST /api/student/aiot/ai`(reflect/debug 되묻기 — 기존 AiReview 꼴, 서버 모델), `GET/POST/PATCH/DELETE /api/student/aiot/projects`, `POST /api/student/aiot/projects/[id]/share`(토큰 발급).
관리자(`authorizeAdminRequest`, menu `lessons`): `GET /api/admin/aiot/students/[studentId]/progress`, `.../submissions`, `POST /api/admin/aiot/submissions/[id]/feedback/regenerate`, 코멘트는 기존 `/api/admin/lessons/comments/*`.
공개: `GET /share/aiot/[token]` 페이지(이름 없이 코드·블록 그림·챕터 제목, noindex).

## 6. AI 채점·피드백 (`src/lib/aiot/`)
- 코드·미션은 블록랩 `judge` 가 서버에서 다시 계산한 결과만 쓴다(AI 는 점수를 매기지 않음).
- `textAnswersOf(snapshot)` 로 글 답을 모은다: 문제 만나기 답, 조건 분석 세 칸, 예측 빈칸, 디버깅 "왜 이런 증상일까", 설계 빈칸, 성찰 4문항, 줄 설명(lineExplain), 1분 설명 메모.
- 지시문(`ai-prompts.ts` 꼴, `VOICE` 를 학년대별 3종으로: 초등 저학년·초등 고학년/중1·중2~고): 단계 유형별 기준표(성찰은 "막힌 순간·해 본 것·다음에" 가 있는가, 조건 분석은 알아야/정해야/움직여야가 센서·값과 맞는가 …). 출력 JSON `{ level, perStep: [{ stepId, mark: "잘함"|"보통"|"더 생각", praise, nextQuestion }], overall, forTeacher }` — 학생에게는 praise·nextQuestion·overall, 관리자에게는 forTeacher 도.
- 호출은 제출당 1회(`createAIProvider("openai")`, `OPENAI_MODEL`), 토큰 예산 3000, 실패 시 `feedback_status='failed'` 와 "선생님이 곧 봐 줄게요" 문구, 관리자가 다시 생성.

## 7. 허브 화면
- 학생: 갤러리 카드(기존 `LessonCard`) → `/student/lessons/python-aiot` 챕터 목록(두 트랙 탭) → `/student/lessons/python-aiot/[chapterId]`(블록랩 `ChapterView`, 전체 화면 lesson-shell) → `/[stepId]`(StepView) → 챕터 끝 제출 카드 → 제출 뒤 피드백·코멘트 카드(`ChapterComment` 재사용). **마이 페이지** `/student/lessons/python-aiot/my`: 작품 목록(제목·저장 시각·열기·공유 링크 복사·삭제), 제출 목록(챕터·버전·AI 총평·코멘트 읽음), 자유 코딩 `/student/lessons/python-aiot/lab`(LabView, 저장 = 작품).
- 관리자: `/admin/lessons/python-aiot`(기존 과목·챕터 화면에 kind blocklab 카드 처리) → 챕터 → 학생 → 제출 보기(`ChapterReviewView` 읽기 전용 + 규칙 결과 + AI 피드백 + 코멘트 편집·보내기) · `/admin/lessons/python-aiot/preview/[chapterId]/[stepId]`(모든 단계 열람, review 모드) · 학생 작품 열람.
- 모바일 390px 가드 테스트 통과, 이모지·방향어 없음, 허브 shadcn 토큰 사용.

## 8. 보안·헤더·환경
- iframe 안 씀. CSP 변경 없음(Blockly·CodeMirror 는 eval 불필요 — 라이브러리 빌드 뒤 `unsafe-eval` 없이 e2e 로 확인). `Permissions-Policy` 에 `serial=(self)` 추가(Web Serial 보드 연결; usb 는 그대로 거부).
- 라이브러리 청크는 `/_next/static` 으로 나가므로 proxy 매처 예외 불필요.
- 개발 DB(`ibyrac…`)에만 `supabase db push`; 운영은 선생님 승인 뒤 같은 명령. 시드 마이그레이션은 과정 연결을 넣지 않는다(원장이 화면에서).
- AI 키·모델은 허브 서버 환경 변수만. 블록랩 체험판의 교사 키 방식은 체험판에만 남는다.

## 9. 테스트·완료 기준
- 블록랩: 기존 1731 테스트 + 라이브러리 진입점·어댑터·review 모드·스냅샷 함수 테스트, `vite build --config vite.lib.config.ts` 산출물 크기·export 검사, 체험판 e2e 그대로.
- 허브: 마이그레이션 RLS 테스트, API 라우트 테스트(권한·검증), `python-aiot` 시드 동기화 테스트, AI 프롬프트·파싱 테스트, 화면 테스트(jsdom), e2e fixture 화면 2개(학생 챕터 흐름 + 관리자 열람) 모바일/데스크톱, `pnpm lint`·`typecheck`·`build`.
- 완료: 개발 DB 에서 학생 계정으로 S1 챕터를 끝까지 하고 제출 → AI 피드백 → 관리자 코멘트 → 학생이 읽음, 작품 저장 → 마이 페이지 → 공유 링크 열림, 성장 리포트 근거에 표시. 그 뒤 선생님이 main 반영과 운영 DB 적용을 승인.

## 10. 단계(계획 문서로 옮길 순서)
A. 블록랩 라이브러리화(Provider·어댑터·Navigator·review 모드·제출 카드·스냅샷·lib 빌드·CSS 범위) → 태그 `lib-v1.0.0`.
B. 허브 마이그레이션 + 시드(python-aiot) + vendor 스크립트 + 라이브러리 import 골격(학생 챕터 화면이 뜨고 진행이 저장됨).
C. 제출 + 서버 판정 + AI 피드백 + 관리자 검토·코멘트·열람 모드.
D. 마이 페이지·작품·공유 링크·성장 리포트 근거·자유 코딩.
E. e2e·접근성·모바일·보안 헤더 확인, 개발 DB 실사용 점검, 보고.

## 11. 열어 둔 질문 (기본값으로 진행, 바꾸시려면 말씀해 주세요)
- 공유 링크 만료: 기본 없음(작품은 개인정보 없음). 관리자가 끌 수 있음.
- 학년 정보: `students.school_grade` 를 관리자가 입력. 입력 전에는 과정의 권장 학년 → 초5~6 말투.
- 제출 가능 조건: 챕터의 필수 단계가 모두 완료일 때만(explainGate 가 켜져 있으면 확인까지).
- 체험판(GitHub Pages)은 유지하되 제출·마이 페이지는 없음.
