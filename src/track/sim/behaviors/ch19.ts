import { every, once, type Behavior } from "../engine";

/**
 * 19장 조이스틱 — 설계 「조금씩 도는 서보」(design_step_servo.py): 90도에서 시작해 0.02초마다
 * 36번(X) 값이 1000 보다 작으면 1도 줄이고, 3000 보다 크면 1도 늘려 4번 서보를 그 각도로 돌린다 (0~180도 안에서)
 * 화면에서는 시리얼 모니터에 X · Y · 버튼 값도 0.3초마다 찍는다 (읽기 단계 step1 처럼) — Y 와 버튼을 움직여도 값이 바뀌는 것을 볼 수 있게.
 */
const behavior: Behavior = (b) => {
  if (once(b)) {
    b.servo(4, 0); // duty_u16(1638)
    b.state.angle = 90;
  }
  every(b, 0.02, () => {
    let angle = b.state.angle as number;
    if (b.adc(36) < 1000) angle = angle - 1;
    else if (b.adc(36) > 3000) angle = angle + 1;
    if (angle < 0) angle = 0;
    if (angle > 180) angle = 180;
    b.state.angle = angle;
    b.servo(4, angle);
  });
  every(b, 0.3, () => b.print(`X: ${b.adc(36)}  Y: ${b.adc(39)}  B: ${b.read(26)}`), "show");
};
export default behavior;
