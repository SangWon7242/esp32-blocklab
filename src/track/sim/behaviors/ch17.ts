import { every, type Behavior } from "../engine";

/** 17장 초음파 거리 — 미션: 0.5초마다 거리를 재서 찍고, 15cm 보다 가까우면 26번 LED 를 켠다 (처음 2초는 센서가 깨어나는 시간) */
const behavior: Behavior = (b) => {
  if (b.t < 2) return;
  every(b, 0.5, () => {
    const d = Math.floor(b.distance(13));
    b.print(`${d} cm`);
    b.write(26, d < 15);
  });
};
export default behavior;
