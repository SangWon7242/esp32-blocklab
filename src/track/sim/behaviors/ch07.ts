import type { Behavior } from "../engine";

/** 7장 작은 선풍기 — 설계(design_fan.py): IN+(13) · IN−(12) PWM 으로 약하게(500) 3초 → 세게(1023) 3초 → 1초 멈춤 → 거꾸로 세게 2초 → 멈춤 (한 번만) */
const behavior: Behavior = (b) => {
  const forward = (speed: number) => { b.pwm(13, speed / 1023); b.pwm(12, 0); };
  const backward = (speed: number) => { b.pwm(13, 0); b.pwm(12, speed / 1023); };
  const stop = () => { b.pwm(13, 0); b.pwm(12, 0); };
  const t = b.t;
  if (t < 3) forward(500);
  else if (t < 6) forward(1023);
  else if (t < 7) stop();
  else if (t < 9) backward(1023);
  else stop();
};
export default behavior;
