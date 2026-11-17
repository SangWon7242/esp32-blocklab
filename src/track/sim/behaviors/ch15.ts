import { every, type Behavior } from "../engine";

/** 15장 온습도 센서 — 설계 「불쾌지수 알림」(design_comfort.py): 2초마다 13번 DHT11 로 온도 · 습도를 재서 불쾌지수를 찍고, 75 이상이면 26번 LED 를 켠다 */

/** MicroPython(ESP32) 이 실수를 찍는 모양: 32비트 실수, 유효 숫자 7자리, 정수 값이면 끝에 .0 */
const pyFloat = (x: number) => {
  const v = Number(Math.fround(x).toPrecision(7));
  return Number.isInteger(v) ? `${v}.0` : String(v);
};

const behavior: Behavior = (b) => {
  every(b, 2, () => {
    const { temp, humidity } = b.dht();
    // DHT11 은 정수로 준다
    const t = Math.round(temp), h = Math.round(humidity);
    const di = 0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3;
    b.print(pyFloat(di));
    b.write(26, di >= 75);
  });
};
export default behavior;
