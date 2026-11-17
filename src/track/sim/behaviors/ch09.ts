import { CARDS, once, type Behavior, type Board } from "../engine";

/**
 * 9장 화면이 있는 출입문 — 미션 「닫히기까지 세기」(mission_countdown.py): 등록된 카드면 4번 서보(문)를 열고
 * OLED 에 OPEN · Close: 3 → 2 → 1 을 1초씩 보여 준 뒤 문을 닫는다. 모르는 카드면 DENIED 를 3초 보여 준다
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
  const show = (a: string, c: string) => b.oled([a, c]);
  if (once(b)) {
    b.servo(4, CLOSE);
    show("Tag your", "card...");
  }
  if (waiting(b)) return;
  const uid = b.card();
  if (!uid) return;
  if (uid === CARDS.known) {
    b.servo(4, OPEN); // 문 열기
    play(b, [
      ...[3, 2, 1].map((t): Step => [() => show("OPEN", `Close: ${t}`), 1]), // for t in range(3, 0, -1)
      [() => { b.servo(4, CLOSE); show("Tag your", "card..."); }, 0],
    ]);
  } else {
    play(b, [
      [() => show("DENIED", "Unknown card"), 3],
      [() => show("Tag your", "card..."), 0],
    ]);
  }
};
export default behavior;
