import { every, type Behavior } from "../engine";

/**
 * 20장 키패드와 리모컨 — 설계 「리모컨으로 켜는 전등」(design_ir_led.py): 0.1초마다 5번 IR 수신기 값을 읽어
 * OK 버튼("0xff02fd")이면 2번 LED 를 켜고, 다른 버튼이면 끈다 (아무것도 안 받았으면 그대로)
 * 화면에서는 키패드도 함께: 누른 키를 시리얼에 찍는다 (step1_keypad.py 처럼).
 */
const behavior: Behavior = (b) => {
  every(b, 0.1, () => {
    const value = b.ir(); // ir.ir_read()
    if (value === "OK") b.write(2, 1);
    else if (value) b.write(2, 0);
    const key = b.key(); // keypad.scan()
    if (key) b.print(key);
  });
};
export default behavior;
