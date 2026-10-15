# scripts

## 슬라이드 내보내기 (`npm run slides`)

학생이 사이트에서 진행하는 챕터(`content/chapters/<id>/chapter.yaml`)로 수업용 슬라이드(pptx)를 만든다.
챕터가 원본이고 슬라이드는 거기서 매번 새로 만들므로, 글·그림을 고치면 다시 내보내기만 하면 된다
(근거: `docs/reports/2026-10-15-legacy-courses-to-esp32.md` 8절).

```sh
npx playwright install chromium        # 처음 한 번 (그림을 PNG 로 그릴 브라우저)
npm run slides -- 01-led               # 챕터 하나 → slides/01-led.pptx
npm run slides -- 01-led 10-auto-door  # 여러 개
npm run slides -- all                  # 모든 챕터
```

| 옵션 | 뜻 |
|---|---|
| `--out <폴더>` | 저장할 폴더 (기본 `slides/`) |
| `--no-images` | 그림 없이 (브라우저를 띄우지 않음) |
| `--font <글꼴>` | 본문 글꼴. 기본: macOS 는 `Apple SD Gothic Neo`, 그 밖은 `Malgun Gothic` |
| `--code-font <글꼴>` | 코드 글꼴. 기본: macOS 는 `Menlo`, 그 밖은 `Consolas` |

결과 `slides/<id>.pptx` 와 그림 캐시 `slides/.cache/` 는 git 에 올리지 않는다(`.gitignore`).

### 장 순서

1. 표지: 번호(`label`, 없으면 "챕터 n")·제목·부제·요약·표지 그림
2. 목표와 성공 기준 (`goals`·`successCriteria` 가 있을 때)
3. 준비물: 부품 카드(그림·메모), 한 장에 8개
4. 배선: 배선도 크게 + 캡션
5. 원리: 글 + 오른쪽 그림
6. 단계마다 (제목 띠에 유형 배지·시간)
   - 장면 그림 + 상황 글(`body`) + 지금 할 일(`todo`)
   - `problem`: 생각해 볼 질문
   - `analysis`: 세 칸 보드(빈 칸, 예시 답 없음)
   - `predict`: 코드 카드 + 예측 질문
   - `run`: 코드 카드(파일 전체, 22줄 넘으면 여러 장) → 실행 결과·코드 설명
   - `readcheck`: 읽을 코드 → 문항(답·힌트 없음)
   - `mission`: 미션·힌트·시작 코드 파일 이름(정답 코드 없음)
   - `debug`: 증상마다 고장 난 코드 + 되묻기
   - `design`: 우리말 설계도(빈칸은 빈칸 그대로) + 번역표
   - `reflect`: 줄마다 설명 쓰기 안내 + 네 칸
7. 교사용: 교사 메모(`teacherNotes`, 있을 때) + 수업 흐름(단계·유형·시간) + "정답·힌트는 사이트 교사 모드에서"

### 만드는 방식

- `scripts/export-slides.ts`: 명령줄. `scripts/slides/chapter.ts` 가 YAML 을 읽고(형식 검사는 `npm test` 몫),
  `scripts/slides/deck.ts` 가 [pptxgenjs](https://gitbrent.github.io/PptxGenJS/) 로 16:9 장을 만든다.
- 안내 글 markdown 은 `scripts/slides/text.ts` 가 문단·글머리·번호·**굵게**·`코드` 토막으로 바꾼다.
  글 장은 본문 8줄 이하가 되도록 글자 폭을 어림해 여러 장으로 나눈다(교사용 장만 18pt 로 12줄).
- 그림: `scripts/slides/raster.ts` 가 Playwright chromium 으로 SVG 를 흰 바탕·폭 1600px PNG 로 그린다.
  화면과 같은 색 변수(`--muted` 등, 밝은 모드)를 넣어 그리고, SVG 내용의 해시로 `slides/.cache/` 에 저장한다.
  브라우저를 못 띄우면 경고를 한 번 내고 그림 없이 만든다.
- pptxgenjs 가 만든 슬라이드 XML 을 `fixSlideXml` 로 다듬는다: 한 문단에 문단 속성이 여러 번 들어가 글머리가 사라지는 문제,
  동아시아 글꼴 charset 이 중국어로 적히는 문제(일부 프로그램에서 한글이 안 보임)를 고치고 언어를 `ko-KR` 로.
- 테스트: `src/track/exportSlides.test.ts` (가짜 래스터라이저로 브라우저 없이 1·10장 확인).
- 형식 검사: `npx tsc -p tsconfig.scripts.json` (앱 `tsc -b` 는 테스트가 가져오는 `deck.ts`·`chapter.ts`·`text.ts` 만 본다).

### 한계

- 줄 수는 글자 폭으로 어림한 값이라 실제 글꼴에 따라 한두 줄 다를 수 있다. 넘치면 글상자의 "넘치면 줄이기"가 받친다
  (PowerPoint 는 파일을 열고 글을 고칠 때 다시 맞춘다).
- 글꼴은 한 가지만 적는다. 다른 컴퓨터에 그 글꼴이 없으면 PowerPoint·Keynote 가 비슷한 글꼴로 바꿔 그린다
  (Windows 교실 PC 에서 띄울 거면 `--font "Malgun Gothic" --code-font Consolas`).
- 그림은 밝은 모드 색으로만 그린다. 그림 속 글자는 PNG 라 슬라이드에서 고칠 수 없다(챕터 SVG 를 고치고 다시 내보내기).
- 답을 숨기는 것은 유형별 키 기준이다: `analysis.answer`, `readcheck` 답·힌트, `mission.answerCode`, `debug.answerCode`,
  `design` 빈칸 답, 코드 설명이 답을 말해 줄 수 있는 `readcheck.codeNotes` 는 넣지 않는다. 학생 글(`body`·`todo`) 안에 쓴 답은 그대로 나온다.
- 새 단계 유형(예: 앱 단계)은 제목·장면·상황 글·지금 할 일 장만 만든다. 유형별 장은 `deck.ts` 의 `step()` 에 더한다.
