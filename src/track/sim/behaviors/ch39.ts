import type { Behavior, Board } from "../engine";
import { program, webAccept } from "./program";

/**
 * 39장 교실 센서 상황판 — 실행 3 step3_app_server.py (설계 다음, 폰 앱과 OLED 를 함께 쓰는 마지막 코드):
 * 폰 앱이 2초마다 /data · /light 를 읽을 때마다 OLED 에 페이지 1(빛 34 · 소리 35 · 손잡이 39) 이나
 * 페이지 2(온도 · 습도 · 틸트 14 · PIR 23)를 보이고, 앱의 /cmd?page=1 · 2 로 페이지를 바꾼다
 */
function showPage(b: Board, n: number, t: number, h: number) {
  if (n === 1) b.oled([`L: ${b.adc(34)}`, `S: ${b.adc(35)}`, `K: ${b.adc(39)}`]);
  else b.oled([`T: ${t}C`, `H: ${h}%`, `TILT: ${b.read(14)}`, `PIR: ${b.read(23)}`]);
}

const BUTTONS = [
  { label: "페이지 1", path: "/cmd?page=1" },
  { label: "페이지 2", path: "/cmd?page=2" },
];

const behavior: Behavior = program(function* (b) {
  let { temp: t, humidity: h } = b.dht();
  let last = b.t;
  let page = 1;
  let light = b.adc(34);
  for (;;) {
    const { path, query } = yield* webAccept(b, ["/data", "/light"]);
    if (b.t - last >= 2) {
      last = b.t;
      ({ temp: t, humidity: h } = b.dht());
    }
    if ((query.page ?? "") === "1") page = 1;
    if ((query.page ?? "") === "2") page = 2;
    showPage(b, page, t, h);
    if (path === "/light") light = b.adc(34);
    b.page("Sensor Board", BUTTONS, [`온도 ${t}°C`, `습도 ${h}%`, `빛 ${light}`, `OLED 페이지 ${page}`]);
  }
});
export default behavior;
