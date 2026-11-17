import type { Behavior } from "../engine";

/**
 * 2장 숨쉬는 LED — 미션 「더 천천히」(mission_slower.py): 26번 LED 의 밝기(duty)를 0 → 1022 로 3밀리초마다 1씩 올렸다가
 * 1023 → 1 로 내리기를 끝없이 되풀이한다 (설계 design_breathing.py 는 반복 없이 한 번만 숨쉬어서 반복하는 미션을 골랐다)
 */
const STEP = 0.003; // time.sleep_ms(3)
const N = 1023; // range(1023)
const HALF = N * STEP;

const behavior: Behavior = (b) => {
  const t = b.t % (2 * HALF);
  const i = Math.min(N - 1, Math.floor((t % HALF) / STEP));
  const duty = t < HALF ? i : 1023 - i;
  b.pwm(26, duty / 1023);
};
export default behavior;
