import { every, once, type Behavior } from "../engine";

/**
 * 26장 웹으로 센서 보기 — 설계 「더운 교실 상황판」(design_hot_board.py): 요청마다 13번 DHT11 로 온도 · 습도를 재서
 * 28도보다 더우면 HOT, 아니면 OK 와 T · H 를 보여 주는 교실 상황판 페이지로 답한다. 페이지가 2초마다 새로고침되어 폰이 다시 요청한다.
 * /data 는 온습도 JSON, /light 는 34번 빛 센서 JSON 으로 답한다
 */
const IP = "192.168.0.5";
const TITLE = "교실 상황판";

const behavior: Behavior = (b) => {
  if (b.t < 1) return; // wifi_connect: 공유기에 붙을 때까지 기다린다
  if (once(b)) {
    b.print(`IP: ${IP}`);
    b.print(IP);
    b.state.view = "/";
  }
  const answer = (path: string) => {
    const m = b.dht(); // dht11.measure()
    const t = Math.round(m.temp), h = Math.round(m.humidity);
    const word = t > 28 ? "HOT" : "OK";
    b.state.view = path;
    if (path === "/data") b.page("/data", [], [`{"temp": ${t}, "hum": ${h}}`]);
    else if (path === "/light") b.page("/light", [], [`{"light": ${b.adc(34)}}`]);
    else b.page(TITLE, [], [word, `T: ${t}C`, `H: ${h}%`]);
  };
  const r = b.request(); // web_accept(server)
  if (r) answer(r.split("?")[0]);
  // 상황판 페이지는 2초마다 새로고침(meta refresh)되어 폰이 / 를 다시 요청한다
  every(b, 2, () => {
    if (b.state.view !== "/data" && b.state.view !== "/light") answer("/");
  });
};
export default behavior;
