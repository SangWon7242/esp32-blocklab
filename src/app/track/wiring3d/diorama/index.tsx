import type { ReactNode } from "react";
import { Part } from "../kit";
import type { Layout } from "../layout";
import { useViewer } from "../store";
import { Entrance, ENTRANCE_ROOM } from "./entrance";
import { ALARM_ROOM, AlarmRoom, BOARD_ROOM, CANE_ROOM, CHICK_ROOM, ChickPen, CLIMATE_ROOM, ClimateRoom, CONSOLE_ROOM, DeskFan, FAN_ROOM, GameConsole, HAMMER_ROOM, HammerGame, MOOD_ROOM, MoodLamp, SensorBoard, SmartCane } from "./rooms";
import { CROSSWALK_ROOM, Crosswalk, LAMP_ROOM, StreetLamp } from "./street";

/*
 * 현장 모형 (융합 트랙): 회로 옆에 「실제로 설치하면 이런 모습」을 작게 줄여 놓는다.
 * 회로와 같은 신호로 움직인다 — 서보가 돌면 문 · 차단기가, LED 가 켜지면 가로등 · 경고등이, RGB 가 바뀌면 무드등이.
 * 챕터 번호마다 하나. 자리 크기(room)는 레이아웃이 회로 오른쪽에 비워 둔다.
 */

type Spec = { room: { w: number; d: number }; name: string; text: string; view: () => ReactNode };

const SPECS: Record<string, Spec> = {
  "08": { room: ENTRANCE_ROOM, name: "현장 모형 · 출입문", text: "실제로 설치하면 이런 모습이에요. 등록된 카드를 리더기에 대면 서보 모터가 문을 열고, 문 위 초록 등(26번 LED)이 켜져요.", view: () => <Entrance mode="card" /> },
  "09": { room: ENTRANCE_ROOM, name: "현장 모형 · 출입문", text: "실제로 설치하면 이런 모습이에요. 카드를 대면 벽의 안내 화면(OLED)에 결과가 나오고, 등록된 카드면 서보 모터가 문을 열어요.", view: () => <Entrance mode="oled" /> },
  "10": { room: ENTRANCE_ROOM, name: "현장 모형 · 자동문", text: "실제로 설치하면 이런 모습이에요. 문 위의 초음파 센서가 사람과의 거리를 재고, 가까이 오면 서보 모터가 문을 열었다가 닫아요.", view: () => <Entrance mode="auto" /> },
  "31": { room: FAN_ROOM, name: "현장 모형 · 안전 선풍기", text: "책상 위 선풍기예요. A 버튼으로 켜고 B 버튼으로 세기를 바꾸고, 손이 날개 가까이 오면(초음파) 멈춰요.", view: () => <DeskFan /> },
  "32": { room: CANE_ROOM, name: "현장 모형 · 스마트 지팡이", text: "지팡이 아래쪽 초음파 센서가 앞의 장애물을 재요. 가까울수록 삐 소리가 빨라지고, 어두우면 끝의 등이 깜빡여요.", view: () => <SmartCane /> },
  "33": { room: CLIMATE_ROOM, name: "현장 모형 · 교실", text: "교실 벽에 단 온습도 알리미예요. 불쾌지수를 화면에 보이고 상태 등 색을 바꾸며, 덥고 습하면 선풍기를 돌려요.", view: () => <ClimateRoom /> },
  "34": { room: LAMP_ROOM, name: "현장 모형 · 가로등", text: "기둥의 빛 센서가 주변 밝기를 재고, 어두울수록 가로등을 밝게 켜요. 빛 조절판을 움직여 밤낮을 바꿔 보세요.", view: () => <StreetLamp /> },
  "35": { room: HAMMER_ROOM, name: "현장 모형 · 뿅망치 게임", text: "손을 대고 버튼을 누르면 3번에 1번 서보 모터가 망치를 내려쳐요(WIN). 빗나가면 옆으로 떨어져요.", view: () => <HammerGame /> },
  "36": { room: CONSOLE_ROOM, name: "현장 모형 · 기억력 게임기", text: "화면의 순서를 기억했다가 터치 패드 A · B · C 로 똑같이 누르는 게임기예요.", view: () => <GameConsole pads="touch" /> },
  "37": { room: MOOD_ROOM, name: "현장 모형 · 무드등", text: "침대 머리맡의 무드등이에요. 폰 앱이나 손잡이로 고른 색으로 RGB LED 가 빛나요.", view: () => <MoodLamp /> },
  "38": { room: ALARM_ROOM, name: "현장 모형 · 교실 재난 알리미", text: "불꽃 · 기울기 · 온도로 재난을 알아채면 부저가 울리고 경광등이 돌아요.", view: () => <AlarmRoom /> },
  "39": { room: BOARD_ROOM, name: "현장 모형 · 교실 상황판", text: "교실 게시판의 상황판이에요. 빛 · 소리 · 온습도 · 움직임을 화면에 보여 줘요.", view: () => <SensorBoard /> },
  "40": { room: CROSSWALK_ROOM, name: "현장 모형 · 횡단보도", text: "사람이 다가오면(초음파) 보행자 신호가 초록으로 바뀌고 차단기가 올라가며 삐 소리가 나요.", view: () => <Crosswalk /> },
  "41": { room: CONSOLE_ROOM, name: "현장 모형 · 폭탄 피하기 게임기", text: "A · B 버튼으로 떨어지는 폭탄을 피하는 게임기예요.", view: () => <GameConsole pads="buttons" /> },
  "42": { room: CONSOLE_ROOM, name: "현장 모형 · 달리기 게임기", text: "버튼을 눌러 점프하며 벽돌을 넘는 게임기예요.", view: () => <GameConsole pads="buttons" /> },
  "43": { room: CHICK_ROOM, name: "현장 모형 · 병아리 집", text: "병아리 집의 온습도가 알맞고 사람이 와서 놀아 주면 병아리가 웃으며 뛰어요.", view: () => <ChickPen /> },
};

const num = (chapterId: string | null | undefined) => (chapterId ? /^(\d+)-/.exec(chapterId)?.[1] : undefined);

/** 레이아웃이 비워 둘 현장 모형 자리 (없으면 undefined) */
export function dioramaRoom(chapterId: string | null | undefined): { w: number; d: number } | undefined {
  const n = num(chapterId);
  return n ? SPECS[n]?.room : undefined;
}

/** 초음파 센서 앞에서 끄는 물체 */
export type SonarTarget = "car" | "person" | "hand" | "wall";
export function sonarTargetFor(chapterId: string | null | undefined): SonarTarget {
  switch (num(chapterId)) {
    case "10": case "40": return "person";
    case "31": case "35": return "hand";
    case "32": return "wall";
    default: return "car";
  }
}

export function Diorama({ L }: { L: Layout }) {
  const chapterId = useViewer((s) => s.chapterId);
  const step = useViewer((s) => s.step);
  const n = num(chapterId);
  const spec = n ? SPECS[n] : undefined;
  if (!spec || !L.diorama || step !== null) return null;
  const { at } = L.diorama;
  return (
    <group position={[at.x, at.y, at.z]}>
      <Part id="diorama" label={spec.name} text={spec.text} lift={false}>
        {spec.view()}
      </Part>
    </group>
  );
}
