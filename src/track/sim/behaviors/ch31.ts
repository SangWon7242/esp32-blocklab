import type { Behavior } from "../engine";
import { program } from "./program";

/**
 * 31장 안전 선풍기 — 설계 design_safe_fan.py: A(14) 버튼으로 켜고 끄고, B(27) 버튼으로 1 → 2 → 3 단,
 * 초음파(trig 18)가 2~8cm 에 손을 보면 멈춘다. 날개는 팬 IN+ 13 · IN− 12, 단계 LED 25 · 26 · 33
 */
const behavior: Behavior = program(function* (b) {
  let mode = 0;
  let level = 1;
  let speed = 0;
  for (;;) {
    if (b.read(14) === 0) {
      mode = 1 - mode;
      level = 1;
      while (b.read(14) === 0) yield 0.01;
    }
    if (mode === 1 && b.read(27) === 0) {
      level = level + 1;
      if (level > 3) level = 1;
      while (b.read(27) === 0) yield 0.01;
    }
    const d = Math.floor(b.distance(18));
    if (d > 2 && d < 8) mode = 0;
    speed = mode * level * 300;
    b.print(`${d} ${speed}`);
    // forward(speed)
    b.pwm(13, speed / 1023);
    b.pwm(12, 0);
    // show_level()
    b.write(25, speed >= 300);
    b.write(26, speed >= 600);
    b.write(33, speed >= 900);
    yield 0.1;
  }
});
export default behavior;
