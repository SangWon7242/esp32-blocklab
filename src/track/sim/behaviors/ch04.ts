import type { Behavior } from "../engine";

/** 4장 흐르는 물빛 — 설계(design_flowing.py): LED 다섯 개(18 · 5 · 14 · 17 · 26)를 하나씩 켰다 끄며 0.3초 → 0.2초 → 0.1초씩 점점 빠르게 흐르고, 0.1초는 끝없이 되풀이한다 */
const PINS = [18, 5, 14, 17, 26];

const behavior: Behavior = (b) => {
  const t = b.t;
  let k: number;
  if (t < 1.5) k = Math.floor(t / 0.3); // flow_leds(300)
  else if (t < 2.5) k = Math.floor((t - 1.5) / 0.2); // flow_leds(200)
  else k = Math.floor((t - 2.5) / 0.1) % PINS.length; // while True: flow_leds(100)
  const pin = PINS[Math.min(k, PINS.length - 1)];
  const last = b.state.on as number | undefined;
  if (last !== pin) {
    if (last !== undefined) b.write(last, 0);
    b.write(pin, 1);
    b.state.on = pin;
  }
};
export default behavior;
