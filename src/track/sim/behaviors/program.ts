import type { Behavior, Board } from "../engine";

/*
 * 학생 코드의 순서를 그대로 옮기는 틀 (31~43 · 90장 동작에서 쓴다. 이 파일은 챕터가 아니라 index.ts 가 모으지 않는다).
 *   - 함수 안에서 `yield 초` 가 time.sleep(초) 이다. while True 와 if 를 코드 그대로 적으면 된다
 *   - 함수 안의 b.t 는 「코드가 지금 깨어난 때」 라서 time.ticks_ms() 처럼 쓸 수 있다
 *   - 함수가 끝나면(break 로 반복문을 빠져나간 코드) 마지막 출력을 그대로 둔다
 */

export type Program = Generator<number, void, void>;

type Running = { gen: Program; wake: number; done: boolean };

export function program(main: (b: Board) => Program): Behavior {
  return (frame) => {
    const s = frame.state;
    s.__board = frame;
    let p = s.__program as Running | undefined;
    if (!p) {
      const run: Running = { gen: undefined as unknown as Program, wake: 0, done: false };
      // 동작 함수는 화면마다 새 보드를 받으므로, 코드에는 늘 지금 보드로 이어지는 보드를 준다
      const live = new Proxy({} as Board, {
        get: (_, k) => (k === "t" ? run.wake : Reflect.get(s.__board as Board, k)),
      });
      run.gen = main(live);
      p = s.__program = run;
    }
    let guard = 0;
    while (!p.done && frame.t >= p.wake && guard++ < 5000) {
      const r = p.gen.next();
      if (r.done) { p.done = true; break; }
      p.wake += Math.max(r.value, 0.001);
    }
    // 화면이 오래 멈췄다 돌아오면 밀린 시간은 건너뛴다
    if (!p.done && frame.t - p.wake > 0.5) p.wake = frame.t;
  };
}

/** random.randint(a, b): a 부터 b 까지 (b 도 나온다) */
export const randint = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** 파이썬의 // (아래로 내린 나눗셈) */
export const idiv = (a: number, b: number) => Math.floor(a / b);

export type WebRequest = { path: string; query: Record<string, string> };

export function parseUrl(url: string): WebRequest {
  const [path, q = ""] = url.split("?");
  const query: Record<string, string> = {};
  for (const kv of q.split("&")) {
    if (!kv) continue;
    const [k, v = ""] = kv.split("=");
    query[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { path: path || "/", query };
}

/**
 * conn, path, query = web_accept(server): 폰 요청이 올 때까지 기다린다.
 * 폰 앱은 every 초마다 polls 주소(예: /data)를 읽어 가므로, 그때도 한 바퀴 돈다.
 */
export function* webAccept(b: Board, polls: string[], every = 2): Generator<number, WebRequest, void> {
  const s = b.state as { __polls?: string[]; __pollAt?: number };
  for (;;) {
    const r = b.request();
    if (r) return parseUrl(r);
    if (s.__polls?.length) return parseUrl(s.__polls.shift()!);
    if (s.__pollAt === undefined || b.t >= s.__pollAt) {
      s.__pollAt = (s.__pollAt ?? b.t) + every;
      s.__polls = [...polls];
      continue;
    }
    yield 0.05;
  }
}

/** set_color(r, g, b): RGB LED 세 핀을 0~255 로 (duty = 값 × 1023 // 255) */
export function setColor(b: Board, pins: [number, number, number], rgb: [number, number, number]) {
  pins.forEach((pin, k) => b.pwm(pin, idiv(rgb[k] * 1023, 255) / 1023));
}
