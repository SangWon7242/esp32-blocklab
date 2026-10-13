# ESP32 블록랩

블록과 MicroPython 코드를 양방향으로 오가며 ESP32를 배우는 교육용 웹앱입니다. 블록을 놓으면 코드가 바뀌고, 코드를 고치면 블록이 따라옵니다.

배포 주소: https://sangwon7242.github.io/esp32-blocklab/

## 실행 방법

Node 22 이상과 Chrome 계열 브라우저가 필요합니다.

```bash
npm i
npm run dev
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 배포용 빌드 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:e2e` | 브라우저 테스트 (Playwright) |
| `npm run typecheck` | 타입 검사 |

## 폴더 구조

```
src/
  main.tsx            진입점
  index.css           Tailwind와 shadcn 테마
  app/
    App.tsx           헤더와 HashRouter 라우트 (#/, #/lab)
    pages/HomePage.tsx  시작 화면
    lab/LabPage.tsx     자유 코딩 화면
  components/ui/      shadcn/ui 컴포넌트
  lib/utils.ts        cn() 유틸
.github/workflows/deploy.yml   GitHub Pages 배포
docs/                 설계 문서와 구현 계획
```

## 문서

- [설계 문서](docs/superpowers/specs/2026-10-13-esp32-blocklab-design.md)
- [구현 계획 1: 편집기 코어](docs/superpowers/plans/2026-10-13-plan1-editor-core.md)
