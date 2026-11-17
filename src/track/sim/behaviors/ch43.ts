import type { Behavior } from "../engine";
import { program } from "./program";

/**
 * 43장 병아리 키우기 — 더 해 보기 extra_state_tones.py (DHT · 틸트 · PIR · 부저를 모두 쓰는 가장 완성된 코드):
 * 27번 버튼으로 시작하면 2초마다 온습도가 알맞고(20~28°C, 40~70%) 흔들거나(틸트 14) 사람이 오면(PIR 23) SMILE,
 * 알맞기만 하면 BLANK, 아니면 BAD. 상태가 바뀔 때 25번 부저로 도(523) · 솔(392) · 낮은 도(262).
 * OLED 의 얼굴 그림은 글자로: SMILE (^_^) · BLANK (-_-) · BAD (>_<)
 */
const FACE: Record<string, string> = { SMILE: "(^_^)", BLANK: "(-_-)", BAD: "(>_<)" };

const behavior: Behavior = program(function* (b) {
  let started = false;
  let state = "BLANK";
  let prev = "BLANK";
  b.tone(25, 0);
  b.oled(["", "You Like Chick?", "PRESS START"]);
  for (;;) {
    if (b.read(27) === 0) started = true;
    if (started) {
      const { temp: t, humidity: h } = b.dht();
      const ok = t >= 20 && t <= 28 && h >= 40 && h <= 70;
      if (ok && (b.read(14) === 1 || b.read(23) === 1)) state = "SMILE";
      else if (ok) state = "BLANK";
      else state = "BAD";
      b.oled([`S: ${state}`, `T: ${t}C`, `H: ${h}%`, `      ${FACE[state]}`]);
      if (state !== prev) {
        const [hz, sec] = state === "SMILE" ? [523, 0.2] : state === "BAD" ? [262, 0.4] : [392, 0.2];
        b.tone(25, hz);
        yield sec;
        b.tone(25, 0);
        prev = state;
      }
      yield 2;
    }
    yield 0.1;
  }
});
export default behavior;
