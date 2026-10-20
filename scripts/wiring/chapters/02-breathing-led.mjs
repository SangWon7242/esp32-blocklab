// 센서 S2 "숨쉬는 LED" — 1장과 같은 배선(LED 26번 + 220Ω 저항). 26번으로 PWM 신호가 나간다.
import { ledWiring } from "./01-led.mjs";

export default {
  "wiring-breadboard.svg": ledWiring({
    plusId: "wb2",
    devkitId: "wb2k",
    plusTitle: "숨쉬는 LED 배선도(ESP32 Plus 확장 보드, 1장과 같은 배선): 보드 위쪽 io26 핀 → 브레드보드 22번 줄 → 220Ω 저항 → 17번 줄의 LED 긴 다리(+). 짧은 다리(−)는 16번 줄 → 점퍼선 → 브레드보드 − 줄 → 보드 GND. io26 으로 PWM 신호가 나가요",
    devkitTitle: "기본 보드(ESP32 DevKit V1 30핀) 숨쉬는 LED 배선도(1장과 같은 배선): D26 핀 → 브레드보드 11번 줄 → 220Ω 저항 → 6번 줄의 LED 긴 다리(+). 짧은 다리(−)는 5번 줄 → 점퍼선 → 브레드보드 − 줄 → 보드 GND. D26 으로 PWM 신호가 나가요",
  }),
};
