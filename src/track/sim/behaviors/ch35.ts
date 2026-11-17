import type { Behavior } from "../engine";
import { program, randint } from "./program";

/**
 * 35장 랜덤 뿅망치 — 설계 design_one_third.py (장면에 부저가 없어 extra_sound.py 대신):
 * 손이 20cm 안(초음파 trig 13)에 있을 때 14번 버튼을 누르면 3분의 1 확률로 WIN(서보 90도), 아니면 FAIL(50도), 쉴 때는 180도
 */
const behavior: Behavior = program(function* (b) {
  const show = (a: string, c: string) => b.oled(["", a, c]);
  b.servo(4, 0);
  yield 2;
  show("HAMMER", "1 in 3");
  for (;;) {
    const d = Math.floor(b.distance(13));
    if (b.read(14) === 0 && d <= 20) {
      const num = randint(1, 3);
      if (num === 1) {
        show("WIN", "1 in 3");
        b.servo(4, 90);
      } else {
        show("FAIL", "2 in 3");
        b.servo(4, 50);
      }
      yield 1;
    }
    b.servo(4, 180);
    yield 0.1;
  }
});
export default behavior;
