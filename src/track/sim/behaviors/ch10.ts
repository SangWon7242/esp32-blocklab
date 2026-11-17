import { once, type Behavior, type Board } from "../engine";

/**
 * 10장 자동문 — 미션 「대기 화면에도 거리 보여 주기」(mission_show_distance.py): 0.3초마다 13번(Trig) 초음파로 거리를 재서
 * OLED 에 보여 주고, 15cm 보다 가까우면 4번 서보(문)를 3초 열었다가 닫고 1초 쉰다 (처음 2초는 센서가 깨어나는 시간)
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
  if (once(b)) b.servo(4, CLOSE);
  if (b.t < 2) return; // time.sleep(2)
  if (once(b, "ready")) show("AUTO DOOR", "Come closer");
  if (waiting(b)) return;
  const d = Math.floor(b.distance(13)); // get_distance()
  show("AUTO DOOR", `${d} cm`);
  if (d < 15) {
    play(b, [
      [() => { show("DOOR OPEN", "Welcome"); b.servo(4, OPEN); }, 3],
      [() => { show("DOOR CLOSE", "Bye~"); b.servo(4, CLOSE); }, 1],
      [() => {}, 0.3],
    ]);
  } else {
    play(b, [[() => {}, 0.3]]); // time.sleep_ms(300)
  }
};
export default behavior;
