import { every, type Behavior } from "../engine";
import { setColor } from "./program";

/**
 * 33장 우리 방 기후 — 미션 mission_climate_fan.py (설계 design_climate.py 보다 RGB LED 까지 있어 더 완성된 것):
 * 2초마다 온습도로 불쾌지수(DI)를 셈해 OLED 에 보이고, RGB(27 · 25 · 26) 색을 바꾸며, 75 이상이면 팬(13 · 12)을 돌린다
 */
const RGB: [number, number, number] = [27, 25, 26];

const behavior: Behavior = (b) => {
  every(b, 2, () => {
    const { temp: t, humidity: h } = b.dht();
    const di = 0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3;
    b.oled(["", `T: ${t}C`, `H: ${h}%`, `DI: ${Math.trunc(di)}`]);
    if (di >= 80) setColor(b, RGB, [255, 0, 0]);
    else if (di >= 75) setColor(b, RGB, [255, 128, 0]);
    else if (di >= 68) setColor(b, RGB, [255, 255, 0]);
    else setColor(b, RGB, [0, 255, 0]);
    if (di >= 75) { b.pwm(13, 1); b.pwm(12, 0); } // forward(1023)
    else { b.pwm(13, 0); b.pwm(12, 0); } // stop()
  });
};
export default behavior;
