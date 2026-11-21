/*
 * 조립 안전 안내. 전압을 잘못 잇거나 합선되면 과열 · 고장 · 다칠 수 있는 챕터만 조립 화면(배선 그림 · 3D 조립 순서)에 경고를 띄운다.
 *
 * 무엇이 위험한지는 그 챕터 배선 장면(.3d.json)의 부품에서 정해진다 — safety.test.ts 가 장면을 읽어
 * 이 표와 맞는지 지킨다(새 챕터에 팬 · 배터리 · 펌프 · 서보 · 초음파 · 점퍼 5V 가 들어오면 여기에 적어야 통과).
 *   - 외부 전원(배터리 · 전원 단자) + 팬     → power · blade   (위험)
 *   - 펌프 · 릴레이 · 물 센서                 → water           (위험)
 *   - 서보 · 초음파 · 릴레이 · 확장 보드 점퍼 5V → five-volt     (주의)
 * LED · 버튼 · 센서만 쓰는 챕터는 경고가 없다.
 */
export type HazardId = "power" | "blade" | "water" | "five-volt";
export type SafetyLevel = "danger" | "caution";

export interface Hazard {
  readonly id: HazardId;
  readonly level: SafetyLevel;
  /** 짧은 이름(경고 띠 머리) */
  readonly title: string;
  /** 아이에게 하는 한두 문장 */
  readonly text: string;
}

export const HAZARDS: Readonly<Record<HazardId, Hazard>> = {
  power: {
    id: "power",
    level: "danger",
    title: "배터리 · 외부 전원",
    text: "배터리를 끼운 채 선을 꽂거나 빼지 않아요. 빨강(+)과 검정(−)이 서로 닿으면 배터리와 선이 뜨거워져요.",
  },
  blade: {
    id: "blade",
    level: "danger",
    title: "도는 날개",
    text: "팬 날개가 도는 동안 손가락 · 머리카락 · 연필을 가까이 대지 않아요.",
  },
  water: {
    id: "water",
    level: "danger",
    title: "물 · 펌프",
    text: "물통과 펌프는 보드에서 떨어뜨려 놓고, 젖은 손으로 보드를 만지지 않아요. 물이 쏟아지면 바로 USB 를 빼요.",
  },
  "five-volt": {
    id: "five-volt",
    level: "caution",
    title: "5V 선",
    text: "빨간 5V 선이 GND 나 다른 핀에 닿으면 보드가 뜨거워지거나 고장 나요. 5V 선은 연결 표에 적힌 자리에만 꽂아요.",
  },
};

/** 위험한 챕터마다 늘 보이는 세 줄 */
export const SAFETY_BASICS: readonly string[] = [
  "USB 를 먼저 빼고 조립해요.",
  "다 꽂으면 연결 표와 한 번 더 맞춰 본 뒤 USB 를 꽂아요.",
  "보드가 뜨겁거나 타는 냄새가 나면 바로 USB 를 빼고 선생님께 알려요.",
];

/** 챕터 id → 위험 종류(장면에서 정해짐, safety.test.ts 가 지킨다) */
export const CHAPTER_HAZARDS: Readonly<Record<string, readonly HazardId[]>> = {
  "07-fan": ["power", "blade"],
  "08-access-control": ["five-volt"],
  "09-oled-access": ["five-volt"],
  "10-auto-door": ["five-volt"],
  "17-ultrasonic": ["five-volt"],
  "18-servo": ["five-volt"],
  "19-joystick": ["five-volt"],
  "31-safe-fan": ["power", "blade", "five-volt"],
  "32-smart-cane": ["five-volt"],
  "33-room-climate": ["power", "blade"],
  "35-random-hammer": ["five-volt"],
  "40-crosswalk": ["five-volt"],
  "44-smart-plant": ["water", "five-volt"],
};

export interface ChapterSafety {
  readonly level: SafetyLevel;
  readonly hazards: readonly Hazard[];
  readonly basics: readonly string[];
}

/** 그 챕터의 조립 안전 안내. 위험이 없으면 null */
export function chapterSafety(chapterId: string | null | undefined): ChapterSafety | null {
  const ids = chapterId && Object.hasOwn(CHAPTER_HAZARDS, chapterId) ? CHAPTER_HAZARDS[chapterId]! : [];
  if (!ids.length) return null;
  const hazards = ids.map((id) => HAZARDS[id]);
  // 위험이 하나라도 있으면 빨강, 주의뿐이면 노랑. 위험한 것부터 보인다
  const sorted = [...hazards].sort((a, b) => Number(b.level === "danger") - Number(a.level === "danger"));
  return { level: sorted[0]!.level, hazards: sorted, basics: SAFETY_BASICS };
}
