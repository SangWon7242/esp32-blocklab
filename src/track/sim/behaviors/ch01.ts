import { cycle, type Behavior } from "../engine";

/** 1장 LED 켜기 — 미션 「천천히 깜빡이기」: 26번 LED 를 2초 켜고 1초 끈다 */
const behavior: Behavior = (b) => {
  cycle(b, [
    [() => b.write(26, 1), 2],
    [() => b.write(26, 0), 1],
  ]);
};
export default behavior;
