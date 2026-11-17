import { CARDS, type Behavior, type Board } from "../engine";

/**
 * 22장 RFID — 설계 「등록된 카드면 불 켜기」(design_led.py): 0.1초마다 카드를 보고,
 * 등록된 카드(목록 allowed 안)면 2번 LED 를 1초 켰다가 끈다
 */

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
  if (waiting(b)) return;
  if (b.card() === CARDS.known) {
    play(b, [
      [() => b.write(2, 1), 1],
      [() => b.write(2, 0), 0.1],
    ]);
  } else {
    play(b, [[() => {}, 0.1]]); // time.sleep(0.1)
  }
};
export default behavior;
