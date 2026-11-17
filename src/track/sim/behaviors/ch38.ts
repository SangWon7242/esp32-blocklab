import type { Behavior } from "../engine";
import { program, webAccept } from "./program";

/**
 * 38장 우리 교실 재난 알리미 — 실행 3 step3_web_app.py (설계 다음, 폰 앱이 읽는 마지막 보드 코드):
 * 폰 앱이 2초마다 /data 를 읽을 때마다 불꽃(34) · 온도(DHT 13) · 틸트(14) · 버튼(27)으로 FIRE > QUAKE > HERE > OK 를 정하고,
 * 화재 · 지진이면 25번 부저 880Hz, 앱의 출구 알리기(/cmd?exit=1)면 660Hz 1초
 */
const behavior: Behavior = program(function* (b) {
  b.tone(25, 0);
  for (;;) {
    const { path, query } = yield* webAccept(b, ["/data"]);
    const t = b.dht().temp;
    // 불꽃 센서는 적외선을 보면 값이 오른다 (교재: 평소 수백, 리모컨을 비추면 수천)
    const f = b.adc(34);
    let state: string;
    if (f >= 1500 && t >= 27) state = "FIRE";
    else if (b.read(14) === 1) state = "QUAKE";
    else if (b.read(27) === 0) state = "HERE";
    else state = "OK";
    b.print(state);
    b.print(`${f} ${t}`);
    if (state === "FIRE" || state === "QUAKE") {
      b.tone(25, 880);
      yield 0.5;
      b.tone(25, 0);
    }
    if (path === "/cmd" && (query.exit ?? "") === "1") {
      b.tone(25, 660);
      yield 1;
      b.tone(25, 0);
    }
    // 앱에 답하기 (/data 는 상태와 온도, /cmd 는 OK)
    b.page("교실 상태", [{ label: "출구 알리기", path: "/cmd?exit=1" }], [`상태 ${state}`, `온도 ${t}°C`]);
  }
});
export default behavior;
