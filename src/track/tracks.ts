import type { Chapter, TrackId } from "./schema";
import { allSteps } from "./gating";

/*
 * 두 트랙(센서 / 교과 융합)과 챕터 메타(번호·먼저 할 챕터·초안). 화면(src/app/track)이 쓰는 순수 함수만 둔다.
 * 먼저 할 챕터(prerequisites)는 안내일 뿐 잠그지 않는다 — 관문은 챕터 안에서만 (gating.ts).
 */

export const TRACKS: readonly { id: TrackId; name: string; description: string }[] = [
  { id: "sensor", name: "센서 트랙", description: "모듈 하나, 개념 하나. 부품을 하나씩 익히는 기본기예요." },
  { id: "fusion", name: "교과 융합 트랙", description: "센서 여러 개를 묶어 교과·SDG 문제를 풀어요. 먼저 할 챕터를 끝내고 오면 좋아요." },
];

export const TRACK_NAME: Record<TrackId, string> = { sensor: "센서 트랙", fusion: "교과 융합 트랙" };

export function isTrackId(v: unknown): v is TrackId {
  return v === "sensor" || v === "fusion";
}

/**
 * 계획 11 의 ②~⑤ 에서 만들 챕터 (아직 폴더가 없을 수 있다). 먼저 할 챕터가 여기 있으면 번호·제목을 "준비 중"과 함께 보여 준다.
 * 폴더가 생기면 그 chapter.yaml 의 번호·제목이 우선한다.
 */
export const PLANNED_CHAPTERS: Readonly<Record<string, { label: string; title: string }>> = {
  "11-button-touch": { label: "S8", title: "버튼과 터치" },
  "12-melody-buzzer": { label: "S9", title: "멜로디 버저" },
  "13-clap-dial": { label: "S10", title: "박수 스위치와 다이얼" },
  "14-light-sensor": { label: "S11", title: "밝기 센서" },
  "15-temp-humidity": { label: "S12", title: "온습도 센서" },
  "16-tilt-pir": { label: "S13", title: "기울기·사람 감지" },
  "17-ultrasonic": { label: "S14", title: "초음파 거리" },
  "18-servo": { label: "S15", title: "서보 모터" },
  "19-joystick": { label: "S16", title: "조이스틱" },
  "20-keypad-ir": { label: "S17", title: "키패드와 IR 리모컨" },
  "21-oled": { label: "S18", title: "OLED 화면" },
  "22-rfid": { label: "S19", title: "RFID 카드 읽기" },
  "23-button-king": { label: "S20", title: "시간 재기 — 버튼 왕" },
  "24-interrupt": { label: "S21", title: "버튼이 끼어들기 — 인터럽트" },
  "25-web-led": { label: "S22", title: "폰으로 켜는 LED — 웹서버" },
  "26-web-sensors": { label: "S23", title: "웹페이지에 센서 값" },
  "31-safe-fan": { label: "F4", title: "안전선풍기" },
  "32-smart-cane": { label: "F5", title: "스마트 지팡이" },
  "33-room-climate": { label: "F6", title: "교실 온습도 알리미" },
  "34-street-lamp": { label: "F7", title: "밝기 단계 가로등" },
  "35-random-hammer": { label: "F8", title: "복불복 랜덤 망치" },
  "36-memory-game": { label: "F9", title: "메모리 게임" },
  "37-mood-light": { label: "F10", title: "감성 스마트 무드등" },
  "38-disaster-alarm": { label: "F11", title: "재난 알리미" },
  "39-sensor-board": { label: "F12", title: "우리 반 센서 상황판" },
  "40-crosswalk": { label: "F13", title: "보행자 신호등" },
  "41-bomb-game": { label: "F14", title: "폭탄 피하기 게임" },
  "42-runner-game": { label: "F15", title: "달리는 디콘 — OLED 러닝 게임" },
  "43-chick": { label: "F16", title: "병아리 키우기" },
};

type Records = Readonly<Record<string, { status: string } | undefined>>;

/** 챕터를 다 했는가: 필수 단계(optional 이 아닌 단계)가 모두 done. 건너뛸 수 있는 단계는 따지지 않는다 */
export function chapterDone(chapter: Chapter, records: Records | undefined): boolean {
  return allSteps(chapter).every((s) => s.optional || records?.[s.id]?.status === "done");
}

/** 목록에 보일 챕터: 그 트랙, order 순. 초안(draft)은 교사 모드에서만 */
export function chaptersInTrack<C extends Chapter>(chapters: readonly C[], track: TrackId, teacherMode: boolean): C[] {
  return chapters
    .filter((c) => c.track === track && (teacherMode || c.status !== "draft"))
    .sort((a, b) => a.order - b.order);
}

export type PrerequisiteView = {
  id: string;
  /** 번호 (S15). 모르는 id 면 undefined */
  label?: string;
  /** 제목. 모르는 id 면 id 그대로 */
  title: string;
  /** done: 다 함 · todo: 아직 · planned: 챕터가 아직 없음(준비 중) */
  state: "done" | "todo" | "planned";
};

/** 먼저 할 챕터 목록을 화면용으로: 있는 챕터는 번호·제목·완료 여부, 없는 챕터는 "준비 중" */
export function prerequisiteViews(
  chapter: Chapter,
  chapters: readonly Chapter[],
  progressChapters: Readonly<Record<string, Records | undefined>> | undefined,
): PrerequisiteView[] {
  return (chapter.prerequisites ?? []).map((id) => {
    const found = chapters.find((c) => c.id === id);
    if (found) {
      return { id, label: found.label, title: found.title, state: chapterDone(found, progressChapters?.[id]) ? "done" : "todo" };
    }
    const planned = PLANNED_CHAPTERS[id];
    return { id, label: planned?.label, title: planned?.title ?? id, state: "planned" };
  });
}
