import { every, type Behavior } from "../engine";

/** 14장 밝기 센서 — 설계 「밝기 따라 조절」(design_dimmer.py): 0.2초마다 34번 빛 값(0~4095)을 0~100 으로 바꿔 찍고, 그만큼 26번 LED 밝기를 정한다 (어두울수록 값이 커져 더 밝아진다) */
const behavior: Behavior = (b) => {
  every(b, 0.2, () => {
    const level = Math.floor((b.adc(34) * 100) / 4095);
    b.print(String(level));
    b.pwm(26, Math.trunc((level * 1023) / 100) / 1023);
  });
};
export default behavior;
