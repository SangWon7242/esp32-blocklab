import { every, type Behavior } from "../engine";

/**
 * 24장 인터럽트 — 미션 「깃발 세우기」(mission_flag.py): 14번 버튼을 누르는 순간(IRQ_FALLING) 깃발만 세우고,
 * 0.05초마다 도는 반복이 깃발을 보면 2번 LED 를 켜고 끄기를 바꾼 뒤 깃발을 내린다
 * (설계 design_count.py 는 2번 LED 를 쓰지 않아서, 배선의 LED 까지 움직이는 미션을 골랐다)
 */
const behavior: Behavior = (b) => {
  // button.irq(trigger=Pin.IRQ_FALLING): 화면마다 버튼 값을 보고 1 → 0 으로 떨어지는 순간을 잡는다
  const v = b.read(14);
  if ((b.state.prev ?? 1) === 1 && v === 0) b.state.pressed = true; // on_press()
  b.state.prev = v;
  every(b, 0.05, () => {
    if (b.state.pressed) {
      const led = (b.state.led as number | undefined) ?? 0; // led.value()
      b.state.led = led === 0 ? 1 : 0;
      b.write(2, b.state.led as number);
      b.state.pressed = false;
    }
  });
};
export default behavior;
