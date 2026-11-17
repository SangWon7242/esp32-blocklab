import type { Behavior } from "../engine";
import { program, webAccept } from "./program";

/**
 * 44장 스마트 화분 — 실행 4 step4_app_server.py (설계 다음, 폰 앱과 함께 쓰는 마지막 코드):
 * 폰 앱이 2초마다 /data 를 읽을 때마다 흙(34) · 물통(35) 값을 재서, 물통이 비었으면(500 아래) 펌프를 멈추고 NO WATER,
 * 흙이 말랐거나(1500 아래) 앱에서 /cmd?pump=on 을 보내면 릴레이(26)를 1초만 켰다 끄고 WATERING, 아니면 OK.
 * OLED 에 SOIL · WATER · 상태 세 줄. 흙이 젖고 물통이 주는 것은 시뮬레이터의 화분 세상(engine.ts plant)이 한다
 */
const BUTTONS = [{ label: "물 주기", path: "/cmd?pump=on" }];

const behavior: Behavior = program(function* (b) {
  let state = "OK";
  for (;;) {
    const { query } = yield* webAccept(b, ["/data"]);
    const s = b.adc(34);
    const w = b.adc(35);
    if (w < 500) {
      state = "NO WATER";
    } else if (s < 1500 || (query.pump ?? "") === "on") {
      state = "WATERING";
      b.write(26, 1);
      yield 1;
      b.write(26, 0);
    } else {
      state = "OK";
    }
    b.oled([`SOIL: ${s}`, `WATER: ${w}`, state]);
    b.page("Smart Plant", BUTTONS, [`상태 ${state}`, `흙 ${s}`, `물통 ${w}`]);
  }
});
export default behavior;
