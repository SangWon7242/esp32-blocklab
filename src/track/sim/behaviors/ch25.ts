import { once, type Behavior, type Board } from "../engine";

/**
 * 25장 웹으로 LED 켜기 — 설계 「깜빡이 단추」(design_blink.py): 폰 페이지의 led=on · led=off · led=blink 단추를 누르면
 * 2번 LED 를 켜거나 끄거나 세 번 깜빡인 뒤, 버튼 페이지에 받은 명령을 보여 주며 답한다
 * (폰이 처음 http://IP 로 들어와 받은 버튼 페이지를 실행하자마자 보여 준다)
 */
const IP = "192.168.0.5";
const BUTTONS = ["led=on", "led=off", "led=blink"].map((b) => ({ label: b, path: `/cmd?${b}` })); // web_page 의 단추

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
  if (b.t < 1) return; // wifi_connect: 공유기에 붙을 때까지 기다린다
  if (once(b)) {
    b.print(`IP: ${IP}`);
    b.write(2, 0);
    b.print(`http://${IP}`);
    b.page("LED", BUTTONS, []);
  }
  if (waiting(b)) return;
  const r = b.request(); // web_accept(server)
  if (!r) return;
  const led = new URLSearchParams(r.split("?")[1] ?? "").get("led") ?? "";
  const answer = () => b.page("LED", BUTTONS, led ? [led] : []); // web_send(conn, web_page(...))
  if (led === "on") b.write(2, 1);
  if (led === "off") b.write(2, 0);
  if (led === "blink") {
    const blink: Step[] = [];
    for (let i = 0; i < 3; i++) blink.push([() => b.write(2, 1), 0.3], [() => b.write(2, 0), 0.3]);
    play(b, [...blink, [answer, 0]]);
    return;
  }
  answer();
};
export default behavior;
