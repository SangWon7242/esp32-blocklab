import { every, type Behavior } from "../engine";
import { idiv } from "./program";

/**
 * 34장 똑똑한 가로등 — 설계 design_street_lamp.py: 0.5초마다 36번 빛 값을 0~3 단계로 나눠
 * 어두울수록 26번 LED 를 밝게(100 · 66 · 33 · 0%) 켜고 OLED 에 단계 이름과 밝기를 보인다
 */
const NAMES = ["DARK", "DIM", "MEDIUM", "BRIGHT"];

const behavior: Behavior = (b) => {
  every(b, 0.5, () => {
    const value = b.adc(36);
    let level = idiv((value - 3500) * (3 - 0), 500 - 3500) + 0;
    level = Math.min(Math.max(level, 0), 3);
    const power = idiv((level - 0) * (0 - 100), 3 - 0) + 100;
    b.pwm(26, Math.trunc((power * 1023) / 100) / 1023);
    b.oled([NAMES[level], `LED ${power}%`]);
    b.print(`${value} ${level}`);
  });
};
export default behavior;
