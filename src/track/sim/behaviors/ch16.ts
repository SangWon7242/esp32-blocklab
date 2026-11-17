import { cycle, every, once, printChange, type Behavior } from "../engine";

/**
 * 16장 기울기와 사람 감지 — 3D 에서 세 부품을 모두 써 보도록 두 코드를 함께 돌린다.
 *   - 미션 「넘어짐 경보기」(mission_fall_alarm.py): 14번 틸트가 1(넘어짐)이면 26번 LED 를 켜고 25번 능동 부저를 0.2초씩 삐삐
 *   - 설계 「복도 등」(design_hall_light.py): 23번 PIR 이 사람을 느끼면 LED 를 켜고, 마지막으로 느낀 뒤 5초가 지나면 끈다
 * 코드는 PIR 이 깨어나도록 30초를 기다리지만, 화면에서는 3초만 기다린다.
 */
const WARMUP = 3;

const behavior: Behavior = (b) => {
  const fallen = b.read(14) === 1;
  printChange(b, "tilt", String(fallen ? 1 : 0));
  if (fallen) cycle(b, [[() => b.write(25, 1), 0.2], [() => b.write(25, 0), 0.2]], "beep");
  else { b.write(25, 0); b.state.beep = undefined; }

  if (b.t < WARMUP) { b.write(26, fallen); return; }
  if (once(b, "start")) b.state.last = -Infinity;
  every(b, 0.1, () => {
    if (b.read(23) === 1) b.state.last = b.t;
    const hall = b.t - (b.state.last as number) <= 5;
    b.write(26, fallen || hall);
  });
};
export default behavior;
