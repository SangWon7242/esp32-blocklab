import type { Behavior } from "../engine";
import { program, setColor } from "./program";

/**
 * 40장 똑똑한 횡단보도 — 미션 mission_crosswalk.py (설계 design_crossing.py 는 입력 없이 한 번 도는 순서라 이것을 골랐다):
 * 사람이 10cm 안(초음파 trig 13)에 오면 RGB(27 · 25 · 26) 초록 · 차단기 서보(4) 90도 · 16번 부저 1000Hz 삐,
 * 멀면 빨강 · 0도 · 조용
 */
const RGB: [number, number, number] = [27, 25, 26];

const behavior: Behavior = program(function* (b) {
  b.tone(16, 0);
  b.servo(4, 0);
  yield 2;
  for (;;) {
    const d = Math.floor(b.distance(13));
    b.print(`${d} cm`);
    if (d < 10) {
      setColor(b, RGB, [0, 255, 0]);
      b.servo(4, 90);
      b.tone(16, 1000);
      yield 0.3;
      b.tone(16, 0);
    } else {
      setColor(b, RGB, [255, 0, 0]);
      b.servo(4, 0);
      b.tone(16, 0);
    }
    yield 0.3;
  }
});
export default behavior;
