import type { Behavior, Board } from "../engine";
import { program, setColor, webAccept } from "./program";

/**
 * 37장 감정 무드등 — 설계 design_sleep_timer.py: 폰 앱의 단추가 /cmd?c=… 를 보내면 RGB(27 · 25 · 26)가
 * 끄기 · 손잡이(39번) 색 · 고른 색으로 바뀌고, 켠 뒤 10분이 지나면 저절로 꺼진다. 앱은 2초마다 /data 를 읽는다
 * (이 코드는 14번 버튼을 쓰지 않는다 — 버튼은 앞 미션 mission_mode.py 의 것)
 */
const RGB: [number, number, number] = [27, 25, 26];
const set = (b: Board, r: number, g: number, bl: number) => setColor(b, RGB, [r, g, bl]);

function knobColor(b: Board) {
  const value = b.adc(39);
  if (value < 800) set(b, 255, 0, 0);
  else if (value < 1600) set(b, 0, 255, 0);
  else if (value < 2400) set(b, 0, 0, 255);
  else if (value < 3200) set(b, 255, 0, 255);
  else set(b, 255, 255, 255);
}

function webColor(b: Board, name: string) {
  if (name === "red") set(b, 255, 0, 0);
  else if (name === "green") set(b, 0, 255, 0);
  else if (name === "blue") set(b, 0, 0, 255);
}

const BUTTONS = [
  { label: "빨강", path: "/cmd?c=red" },
  { label: "초록", path: "/cmd?c=green" },
  { label: "파랑", path: "/cmd?c=blue" },
  { label: "손잡이", path: "/cmd?c=knob" },
  { label: "끄기", path: "/cmd?c=off" },
];

const behavior: Behavior = program(function* (b) {
  const ip = "192.168.0.23";
  let mode = 0;
  let color = "off";
  let start = b.t;
  b.print(ip);
  for (;;) {
    const { query } = yield* webAccept(b, ["/data"]);
    const c = query.c ?? "";
    if (c === "off") {
      mode = 0;
      color = "off";
    } else if (c === "knob") {
      mode = 1;
      color = "knob";
      start = b.t;
    } else if (c !== "") {
      mode = 2;
      color = c;
      start = b.t;
    }
    if (b.t - start > 600) {
      mode = 0;
      color = "off";
    }
    if (mode === 0) set(b, 0, 0, 0);
    else if (mode === 1) knobColor(b);
    else webColor(b, color);
    b.page("Mood Light", BUTTONS, [`모드 ${mode}`, `지금 색 ${color}`]);
  }
});
export default behavior;
