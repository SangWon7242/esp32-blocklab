import { cycle, type Behavior } from "../engine";

/** 3장 신호등 — 미션: 빨강(13) 5초 → 노랑(14) 다섯 번 깜빡 → 초록(16) 5초 */
const behavior: Behavior = (b) => {
  const blink: [() => void, number][] = [];
  for (let k = 0; k < 5; k++) {
    blink.push([() => { if (k === 0) b.write(13, 0); b.write(14, 1); }, 0.5]);
    blink.push([() => b.write(14, 0), 0.5]);
  }
  cycle(b, [
    [() => { b.write(16, 0); b.write(13, 1); }, 5],
    ...blink,
    [() => b.write(16, 1), 5],
  ]);
};
export default behavior;
