import { CARDS, once, type Behavior, type Board } from "../engine";

/**
 * 8장 스마트 출입 통제 — 미션 ② 「문이 열리면 불도 켜지게」(mission_led.py): 카드를 대면 번호를 찍고,
 * 등록된 카드면 4번 서보(문)를 열고 26번 LED 를 켜고, 모르는 카드면 문을 닫고 LED 를 끈 뒤 1초 쉰다.
 * (설계 design_access.py 는 26번 LED 를 쓰지 않아서, 배선에 있는 LED 까지 움직이는 미션 ② 를 골랐다)
 */
const OPEN = 180; // duty_u16(8100)
const CLOSE = 0; // duty_u16(1638)

/** time.sleep 이 든 덩어리: [할 일, 그 뒤 쉬는 초] 를 차례로 한다. 쉬는 동안은 true */
type Step = [() => void, number];
function waiting(b: Board): boolean {
  const q = (b.state.todo ??= []) as Step[];
  while (q.length && b.t >= ((b.state.wake as number | undefined) ?? 0)) {
    const [fn, sec] = q.shift()!;
    fn();
    b.state.wake = b.t + sec;
  }
  return b.t < ((b.state.wake as number | undefined) ?? 0);
}
function play(b: Board, steps: Step[]) {
  ((b.state.todo ??= []) as Step[]).push(...steps);
  waiting(b);
}

const behavior: Behavior = (b) => {
  if (once(b)) {
    play(b, [[() => { b.servo(4, CLOSE); b.write(26, 0); }, 1]]); // 문 닫고 불 끄고 time.sleep(1)
  }
  if (waiting(b)) return;
  const uid = b.card(); // card_present(rc522) · card_uid(rc522)
  if (!uid) return;
  b.print(`Card UID: ${uid}`);
  if (uid === CARDS.known) {
    play(b, [[() => { b.servo(4, OPEN); b.write(26, 1); }, 1]]);
  } else {
    play(b, [[() => { b.servo(4, CLOSE); b.write(26, 0); }, 1]]);
  }
};
export default behavior;
