import type { Device } from "./circuit";

/*
 * 시뮬레이션 엔진: 보드 한 대를 흉내 낸다.
 *   - 입력(Inputs): 학생이 3D 에서 조작한 것 (버튼 누름, 손잡이 각도, 빛, 거리, 사람, 카드 …)
 *   - 동작(Behavior): 그 챕터의 완성 코드가 하는 일. 학생 코드처럼 핀 번호로 읽고 쓴다 (b.read(14), b.write(26, 1))
 *   - 출력(Outputs): 핀의 상태 · 서보 각도 · 부저 음 · OLED 글자 … 3D 가 이것을 보고 움직인다
 * 핀은 실물처럼 한 번 쓰면 바꿀 때까지 그 값을 유지한다. 동작 함수는 화면이 그려질 때마다 불린다.
 */

export type Inputs = {
  /** 부품 번호 → 눌렸는지 (버튼 · 터치 패드) */
  pressed: Record<number, boolean>;
  /** 가변저항 손잡이 0~1 */
  knob: Record<number, number>;
  /** 조이스틱 -1~1, 버튼 */
  joy: Record<number, { x: number; y: number; pressed: boolean }>;
  /** 주변 밝기 0~1 */
  light: number;
  /** 손으로 가린 포토레지스터 */
  covered: Record<number, boolean>;
  /** 초음파 센서 앞 물체까지 cm */
  distance: Record<number, number>;
  /** 사람(PIR 감지 범위 안) */
  motion: boolean;
  /** 기울인 틸트 스위치 */
  tilted: Record<number, boolean>;
  /** 소리 크기 0~1 (박수를 치면 잠깐 커진다) */
  sound: number;
  /** 불꽃이 가까이 있는지 */
  flame: boolean;
  temp: number;
  humidity: number;
  /** RFID 리더에 댄 카드 번호 (없으면 null) */
  card: string | null;
  /** 아직 읽지 않은 키패드 · 리모컨 누름 */
  keys: string[];
  ir: string[];
  /** 폰 브라우저가 보낸 요청 주소 (예: "/cmd?led=on") — 아직 읽지 않은 것 */
  web: string[];
};

export const defaultInputs = (): Inputs => ({
  pressed: {}, knob: {}, joy: {}, light: 0.75, covered: {}, distance: {}, motion: false, tilted: {},
  sound: 0, flame: false, temp: 24, humidity: 45, card: null, keys: [], ir: [], web: [],
});

export type Outputs = {
  /** 핀 → 0~1 (디지털은 0 · 1, PWM 은 그 사이) */
  pins: Record<number, number>;
  servo: Record<number, number>;
  /** 핀 → 부저 음 높이 Hz (0 이면 조용) */
  tone: Record<number, number>;
  oled: string[] | null;
  /** 7세그먼트에 보이는 숫자 · 글자 (null 이면 꺼짐) */
  seg7: string | null;
  /** 시리얼 모니터 줄 (새것이 뒤) */
  serial: string[];
  /** 마지막으로 핀을 바꾼 때 (보드의 파란 LED 가 깜빡인다) */
  activity: number;
  /** 폰 화면: 보드의 웹서버가 보여 주는 단추 · 글 (WiFi 챕터) */
  phone: { title: string; buttons: { label: string; path: string }[]; lines: string[] } | null;
};

export type Board = {
  /** 실행하고 지난 초 */
  t: number;
  /** 지난 화면에서 지난 초 */
  dt: number;
  /** 동작 함수가 기억해 둘 것 (실행할 때마다 비운다) */
  state: Record<string, unknown>;
  /** 디지털 입력 0 · 1 (Pin.value()) */
  read: (pin: number) => 0 | 1;
  /** 아날로그 입력 0~4095 (ADC.read()) */
  adc: (pin: number) => number;
  /** 터치 패드 값 (손가락을 대면 작아진다) */
  touch: (pin: number) => number;
  /** 초음파 거리 cm (get_distance()). 센서가 여럿이면 trig 핀으로 고른다 */
  distance: (trig?: number) => number;
  /** 온습도 (dht.temperature(), dht.humidity()) */
  dht: () => { temp: number; humidity: number };
  /** RFID 카드 번호 (없으면 null) */
  card: () => string | null;
  /** 키패드에서 새로 누른 키 (없으면 null) */
  key: () => string | null;
  /** 리모컨에서 새로 누른 단추 (없으면 null) */
  ir: () => string | null;
  write: (pin: number, v: number | boolean) => void;
  /** PWM 0~1 (duty / 1023) */
  pwm: (pin: number, v: number) => void;
  servo: (pin: number, angle: number) => void;
  /** 부저 음 (0 이면 끔) */
  tone: (pin: number, hz: number) => void;
  oled: (lines: string[]) => void;
  seg7: (text: string | null) => void;
  print: (line: string) => void;
  /** 폰 화면에 보일 웹 페이지: 제목 · 단추(누르면 그 주소로 요청) · 글 */
  page: (title: string, buttons: { label: string; path: string }[], lines?: string[]) => void;
  /** 폰에서 새로 온 요청 주소 (없으면 null) */
  request: () => string | null;
};

export type Behavior = (b: Board) => void;

/** 등록된 카드 (챕터 코드의 허락된 카드 번호와 같다) · 모르는 카드 */
export const CARDS = { known: "0x6A2B9C11", unknown: "0x13F0C2AA" } as const;

export class Simulator {
  readonly outputs: Outputs = { pins: {}, servo: {}, tone: {}, oled: null, seg7: null, serial: [], activity: -1, phone: null };
  /** 이번 화면에서 읽은 값 (읽은 값 판) */
  readonly readings = new Map<string, string>();
  private t = 0;
  private state: Record<string, unknown> = {};

  readonly devices: Device[];
  readonly behavior: Behavior | undefined;
  readonly inputs: Inputs;

  constructor(devices: Device[], behavior: Behavior | undefined, inputs: Inputs) {
    this.devices = devices;
    this.behavior = behavior;
    this.inputs = inputs;
  }

  reset() {
    this.t = 0;
    this.state = {};
    Object.assign(this.outputs, { pins: {}, servo: {}, tone: {}, oled: null, seg7: null, serial: [], activity: -1, phone: null });
    this.inputs.web.length = 0;
    this.inputs.keys.length = 0;
    this.inputs.ir.length = 0;
    this.readings.clear();
  }

  private find<K extends Device["kind"]>(kind: K, test?: (d: Extract<Device, { kind: K }>) => boolean) {
    return this.devices.find((d): d is Extract<Device, { kind: K }> => d.kind === kind && (!test || test(d as Extract<Device, { kind: K }>)));
  }

  /** 핀 하나의 디지털 값: 그 핀에 이어진 입력 장치를 보고 정한다 (없으면 풀업처럼 1) */
  private digital(pin: number): 0 | 1 {
    const i = this.inputs;
    for (const d of this.devices) {
      if (d.kind === "button" && d.pin === pin) return (i.pressed[d.part] ? (d.activeLow ? 0 : 1) : d.activeLow ? 1 : 0);
      if (d.kind === "tilt" && d.pin === pin) {
        // 바로 서 있으면 구슬이 다리를 이어 스위치가 닫힌다
        const closed = !i.tilted[d.part];
        return closed ? (d.activeLow ? 0 : 1) : d.activeLow ? 1 : 0;
      }
      if (d.kind === "pir" && d.pin === pin) return i.motion ? 1 : 0;
      if (d.kind === "flame" && d.pin === pin) return i.flame ? 0 : 1;
      if (d.kind === "sound" && d.pin === pin) return i.sound > 0.5 ? 1 : 0;
      if (d.kind === "joystick" && d.b === pin) return i.joy[d.part]?.pressed ? 0 : 1;
      if (d.kind === "ultrasonic" && d.echo === pin) return 0;
    }
    // 출력으로 쓰는 핀은 마지막으로 쓴 값
    const v = this.outputs.pins[pin];
    return v !== undefined ? (v >= 0.5 ? 1 : 0) : 1;
  }

  private analog(pin: number): number {
    const i = this.inputs;
    const noise = () => Math.round((Math.random() - 0.5) * 24);
    const clamp = (v: number) => Math.max(0, Math.min(4095, Math.round(v)));
    for (const d of this.devices) {
      if (d.kind === "pot" && d.pin === pin) return clamp((i.knob[d.part] ?? 0.5) * 4095 + noise());
      if (d.kind === "photo" && d.pin === pin) {
        const lux = i.covered[d.part] ? 0.04 : i.light;
        // 실제 전압 나누기처럼 끝으로 갈수록 덜 움직인다
        const v = 4095 * (lux / (lux + 0.25)) * 1.25;
        return clamp((d.brighterIsHigher ? v : 4095 - v) + noise());
      }
      if (d.kind === "sound" && d.pin === pin) return clamp(180 + i.sound * 3600 + Math.abs(noise()) * 3);
      // 불꽃(적외선)이 비치면 값이 커진다 (평소 수백)
      if (d.kind === "flame" && d.pin === pin) return clamp((i.flame ? 3600 : 300) + noise());
      if (d.kind === "joystick") {
        const j = i.joy[d.part] ?? { x: 0, y: 0, pressed: false };
        if (d.x === pin) return clamp(2048 + j.x * 2047 + noise());
        if (d.y === pin) return clamp(2048 + j.y * 2047 + noise());
      }
    }
    return this.digital(pin) * 4095;
  }

  /** 화면 한 장: 시간을 dt 만큼 보내고 동작 함수를 부른다 */
  step(dt: number) {
    this.t += dt;
    const o = this.outputs;
    const sim = this;
    const note = (k: string, v: string) => sim.readings.set(k, v);
    const set = (pin: number, v: number) => {
      if (o.pins[pin] !== v) o.activity = sim.t;
      o.pins[pin] = v;
    };
    const board: Board = {
      t: this.t,
      dt,
      state: this.state,
      read: (pin) => { const v = sim.digital(pin); note(`${pin}번 핀`, String(v)); return v; },
      adc: (pin) => { const v = sim.analog(pin); note(`${pin}번 아날로그`, String(v)); return v; },
      touch: (pin) => {
        const d = sim.find("touch", (x) => x.pin === pin);
        const v = d && sim.inputs.pressed[d.part] ? 90 + Math.round(Math.random() * 30) : 600 + Math.round(Math.random() * 60);
        note(`${pin}번 터치`, String(v));
        return v;
      },
      distance: (trig) => {
        const d = sim.find("ultrasonic", (x) => trig === undefined || x.trig === trig);
        const cm = d ? (sim.inputs.distance[d.part] ?? 40) : 400;
        const v = Math.round((cm + (Math.random() - 0.5) * 0.6) * 10) / 10;
        note("초음파 거리", `${v} cm`);
        return v;
      },
      dht: () => {
        note("온도", `${sim.inputs.temp} °C`);
        note("습도", `${sim.inputs.humidity} %`);
        return { temp: sim.inputs.temp, humidity: sim.inputs.humidity };
      },
      card: () => { note("카드", sim.inputs.card ?? "없음"); return sim.inputs.card; },
      key: () => sim.inputs.keys.shift() ?? null,
      ir: () => sim.inputs.ir.shift() ?? null,
      write: (pin, v) => set(pin, v ? 1 : 0),
      pwm: (pin, v) => set(pin, Math.max(0, Math.min(1, v))),
      servo: (pin, angle) => {
        const a = Math.max(0, Math.min(180, angle));
        if (o.servo[pin] !== a) o.activity = sim.t;
        o.servo[pin] = a;
      },
      tone: (pin, hz) => {
        if ((o.tone[pin] ?? 0) !== hz) o.activity = sim.t;
        o.tone[pin] = hz;
      },
      oled: (lines) => {
        if (o.oled?.join("\n") !== lines.join("\n")) { o.oled = [...lines]; o.activity = sim.t; }
      },
      seg7: (text) => {
        if (o.seg7 !== text) { o.seg7 = text; o.activity = sim.t; }
      },
      page: (title, buttons, lines = []) => {
        const next = { title, buttons, lines };
        if (JSON.stringify(o.phone) !== JSON.stringify(next)) o.phone = next;
      },
      request: () => {
        const r = sim.inputs.web.shift() ?? null;
        if (r) { note("받은 요청", r); o.activity = sim.t; }
        return r;
      },
      print: (line) => {
        o.serial.push(line);
        if (o.serial.length > 40) o.serial.splice(0, o.serial.length - 40);
      },
    };
    this.behavior?.(board);
  }

  /** 지금 시간 (실행하고 지난 초) */
  get time() {
    return this.t;
  }
}

/* ───────────── 동작 함수를 쓰기 쉽게 ───────────── */

/** 한 번만: 처음 불릴 때만 true (setup()) */
export function once(b: Board, name = "setup"): boolean {
  if (b.state[name]) return false;
  b.state[name] = true;
  return true;
}

/** 값이 바뀔 때만 시리얼에 찍는다 (같은 줄을 계속 찍지 않게) */
export function printChange(b: Board, name: string, line: string) {
  if (b.state[`print:${name}`] === line) return;
  b.state[`print:${name}`] = line;
  b.print(line);
}

/**
 * time.sleep 이 있는 반복문을 「단계」 로: 단계마다 (할 일, 머무는 초) 를 주면 시간에 맞춰 돌아간다.
 * 예) 깜빡임: cycle(b, [[() => b.write(26, 1), 0.5], [() => b.write(26, 0), 0.5]])
 */
export function cycle(b: Board, steps: [() => void, number][], name = "cycle") {
  const total = steps.reduce((n, [, s]) => n + s, 0);
  let t = b.t % total;
  let k = 0;
  while (k < steps.length - 1 && t >= steps[k][1]) { t -= steps[k][1]; k++; }
  if (b.state[name] !== k) {
    b.state[name] = k;
    steps[k][0]();
  }
}

/** sec 초마다 한 번 (time.sleep 이 있는 반복문 한 바퀴). 처음에는 바로 한 번 */
export function every(b: Board, sec: number, fn: () => void, name = "every") {
  const k = `every:${name}`;
  const last = b.state[k] as number | undefined;
  if (last === undefined || b.t - last >= sec) {
    b.state[k] = last === undefined ? b.t : last + sec * Math.floor((b.t - last) / sec);
    fn();
  }
}
