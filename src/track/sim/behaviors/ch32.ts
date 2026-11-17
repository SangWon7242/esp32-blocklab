import type { Behavior } from "../engine";
import { idiv, program } from "./program";

/**
 * 32장 스마트 지팡이 — 설계 design_cane.py: 30cm 안에 물체가 있으면 가까울수록 빠르게 삐(25번 부저 880Hz),
 * 어두우면(36번 빛 값 > 2500) 26번 LED 깜빡, 지팡이가 누우면(14번 틸트 1) 높은 미(1319Hz) 경보
 */
const behavior: Behavior = program(function* (b) {
  b.tone(25, 0);
  yield 2;
  for (;;) {
    // check_distance()
    const d = Math.floor(b.distance(13));
    if (d < 30) {
      b.tone(25, 880);
      yield 0.1;
      b.tone(25, 0);
      yield (idiv((d - 0) * (500 - 50), 30 - 0) + 50) / 1000;
    }
    // check_light()
    if (b.adc(36) > 2500) {
      b.write(26, 1);
      yield 0.1;
      b.write(26, 0);
    }
    // check_tilt()
    if (b.read(14) === 1) {
      b.tone(25, 1319);
      yield 0.25;
      b.tone(25, 0);
    }
    yield 0.1;
  }
});
export default behavior;
