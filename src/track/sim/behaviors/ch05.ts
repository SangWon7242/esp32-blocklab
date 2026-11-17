import { cycle, type Behavior } from "../engine";

/** 5장 RGB LED — 추가 미션 「무지개」(extra2_rainbow.py): 빨강(27) · 초록(25) · 파랑(26) 세 PWM 으로 빨주노초파남보 일곱 색을 0.5초씩 끝없이 바꾼다 */
const RAINBOW: [number, number, number][] = [[255, 0, 0], [255, 128, 0], [255, 255, 0], [0, 255, 0], [0, 0, 255], [75, 0, 130], [148, 0, 211]];

const behavior: Behavior = (b) => {
  // set_color: 0~255 를 duty 0~1023 으로 (r * 1023 // 255)
  const setColor = (r: number, g: number, bl: number) => {
    b.pwm(27, Math.floor((r * 1023) / 255) / 1023);
    b.pwm(25, Math.floor((g * 1023) / 255) / 1023);
    b.pwm(26, Math.floor((bl * 1023) / 255) / 1023);
  };
  cycle(b, RAINBOW.map(([r, g, bl]) => [() => setColor(r, g, bl), 0.5]));
};
export default behavior;
