import { every, once, printChange, type Behavior } from "../engine";

/**
 * 11장 버튼과 터치 — 3D 에서 두 부품을 모두 써 보도록 두 코드를 함께 돌린다.
 *   - 미션 「누를 때마다 켜고 끄기」(mission_toggle.py): 14번 버튼을 누를 때마다 LED 상태가 바뀐다
 *   - 설계 「기준을 스스로 정하는 터치」(design_touch_auto.py): 시작할 때 4번 터치 값의 절반을 기준으로, 호일을 만지는 동안 LED 를 켠다
 * 26번 LED 는 「버튼으로 켠 상태」 이거나 「호일을 만지는 중」 이면 켜진다.
 */
const behavior: Behavior = (b) => {
  if (once(b)) {
    const base = b.touch(4);
    b.print(String(base));
    b.state.limit = Math.floor(base / 2);
    b.state.on = false;
    b.state.held = false;
  }
  every(b, 0.05, () => {
    const pressed = b.read(14) === 0;
    if (pressed && !b.state.held) b.state.on = !b.state.on; // 손을 뗄 때까지 다시 세지 않는다
    b.state.held = pressed;
    const touching = b.touch(4) < (b.state.limit as number);
    if (touching) printChange(b, "touch", "touch!");
    else printChange(b, "touch", "");
    b.write(26, Boolean(b.state.on) || touching);
  });
};
export default behavior;
