import { every, once, type Behavior } from "../engine";

/**
 * 18장 서보 모터 — 미션 「다이얼로 돌리는 서보」(mission_dial_servo.py): 0.02초마다 39번 가변저항 값(0~4095)을
 * 0~180도로 바꿔 4번 서보를 그 각도로 돌린다
 * (설계 design_slow_gate.py 는 한 번 올라갔다 내려오고 끝나서, 손잡이를 돌리면 따라 움직이는 미션을 골랐다)
 */
const behavior: Behavior = (b) => {
  if (once(b)) b.servo(4, 0); // duty_u16(1638)
  every(b, 0.02, () => {
    const angle = Math.floor((b.adc(39) * 180) / 4095); // 0~4095 → 0~180
    b.servo(4, angle);
  });
};
export default behavior;
