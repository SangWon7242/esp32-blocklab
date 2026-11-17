import { every, once, type Behavior } from "../engine";

/**
 * 13장 박수 스위치와 다이얼 — 3D 에서 두 부품을 모두 써 보도록 두 코드를 함께 돌린다.
 *   - 설계 「박수 스위치」(design_clap.py): 36번 소리 값이 2000 보다 크면 박수 수를 세어 찍고, 홀수 번이면 켜고 짝수 번이면 끈다 (그 뒤 0.3초 쉼)
 *   - 미션 「다이얼로 밝기」(mission_dimmer.py): 39번 다이얼 값 0~4095 를 밝기 0~1023 으로
 * 박수로 켜 두면 다이얼로 밝기를 바꿀 수 있다.
 */
const behavior: Behavior = (b) => {
  if (once(b)) {
    b.state.count = 0;
    b.state.until = 0;
  }
  if (b.t >= (b.state.until as number) && b.adc(36) > 2000) {
    const count = (b.state.count as number) + 1;
    b.state.count = count;
    b.print(`clap ${count}`);
    b.state.until = b.t + 0.3; // time.sleep(0.3)
  }
  every(b, 0.02, () => {
    const on = (b.state.count as number) % 2 === 1;
    const duty = Math.floor((b.adc(39) * 1023) / 4095);
    b.pwm(26, on ? duty / 1023 : 0);
  });
};
export default behavior;
