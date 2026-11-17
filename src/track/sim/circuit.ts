import type { Part3D, Pt, Scene3D } from "../wiring3d";

/*
 * 배선 장면을 「회로」로 읽는다: 어느 부품의 어느 다리가 보드의 몇 번 핀(GPIO)에 이어졌는지.
 * 시뮬레이션(부품을 누르면 LED 가 켜지는 등)이 학생 코드와 같은 핀 번호로 말할 수 있게 한다.
 *
 * 잇는 규칙 (실물과 같다)
 *   - 브레드보드: 같은 열의 다섯 칸(가운데 홈의 같은 쪽)은 속에서 이어져 있다. + − 줄은 옆으로 길게 이어져 있다
 *   - 선: 두 끝을 잇는다.  보드 핀 · 모듈 핀 · 서보 플러그 구멍: 그 자리의 점
 *   - 저항: 「구리 그물」 에서는 끊고(양쪽이 다른 전기), 「신호 그물」 에서는 잇는다(LED 를 켜는 핀을 찾을 때 저항을 건너간다)
 */

export type PinKind = { kind: "gpio"; n: number } | { kind: "gnd" } | { kind: "v33" } | { kind: "v5" } | { kind: "other" };

/** 보드 핀 이름 → 종류. Plus: "io13" · "io13 S" · "io13 V" · "I2C SDA" · "SCL" … DevKit: "D13" · "VP" · "RX2" … */
export function pinKind(label: string): PinKind {
  const l = label.trim();
  if (/GND|\bG$/.test(l)) return { kind: "gnd" };
  if (/3V3/.test(l)) return { kind: "v33" };
  if (/5V|VIN|\bV$/.test(l)) return { kind: "v5" };
  if (/SDA/.test(l)) return { kind: "gpio", n: 21 };
  if (/SCL/.test(l)) return { kind: "gpio", n: 22 };
  const alias: Record<string, number> = { VP: 36, VN: 39, RX2: 16, TX2: 17, RX0: 3, TX0: 1, RX: 3, TX: 1 };
  const word = l.split(/[\s(]/)[0];
  if (word in alias) return { kind: "gpio", n: alias[word] };
  const m = /^(?:io|D)(\d+)/.exec(l);
  if (m) return { kind: "gpio", n: Number(m[1]) };
  return { kind: "other" };
}

const key = (p: Pt) => `${Math.round(p.x)}:${Math.round(p.y)}`;

class Union {
  private parent = new Map<string, string>();
  find(a: string): string {
    let p = this.parent.get(a);
    if (p === undefined) { this.parent.set(a, a); return a; }
    if (p === a) return a;
    p = this.find(p);
    this.parent.set(a, p);
    return p;
  }
  join(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export type Net = { gpio: number[]; gnd: boolean; v33: boolean; v5: boolean };

export type Circuit = {
  /** 그 점(구멍 · 다리 · 핀 끝)이 닿은 GPIO (저항을 건너가며 찾는다). 가장 가까운(구리로 바로 이어진) 것이 먼저 */
  gpioOf: (p: Pt) => number | undefined;
  /** 그 점의 구리 그물 (저항을 건너지 않는다) */
  copper: (p: Pt) => Net;
  /** 그 점의 신호 그물 (저항을 건넌다) */
  signal: (p: Pt) => Net;
};

export function readCircuit(scene: Scene3D): Circuit {
  const copper = new Union(), signal = new Union();
  const both = (a: string, b: string) => { copper.join(a, b); signal.join(a, b); };

  // 브레드보드
  for (const bb of scene.breadboards) {
    const mid = (bb.gap[0] + bb.gap[1]) / 2;
    const split = bb.gap[1] > bb.gap[0];
    const strips = new Map<string, string>();
    for (const [x, y] of bb.holes) {
      const s = `${Math.round(x)}|${split && y > mid ? "lo" : "hi"}|${bb.x}:${bb.y}`;
      const k = key({ x, y });
      const first = strips.get(s);
      if (first) both(first, k);
      else strips.set(s, k);
    }
    for (const r of bb.rails) {
      const ks = r.xs.map((x) => key({ x, y: r.y }));
      for (const k of ks.slice(1)) both(ks[0], k);
    }
  }
  // 선
  for (const w of scene.wires) both(key(w.from), key(w.to));
  // 부품 안에서 늘 이어진 다리 (버튼은 홈을 건넌 같은 열 다리끼리)
  for (const p of scene.parts) {
    if (p.type === "button") {
      both(key(p.legs[0]), key(p.legs[2]));
      both(key(p.legs[1]), key(p.legs[3]));
    }
    if (p.type === "resistor") signal.join(key(p.a), key(p.b));
  }

  // 그물마다 보드 핀 종류를 모은다
  const tag = (u: Union) => {
    const nets = new Map<string, Net>();
    const get = (root: string) => {
      let n = nets.get(root);
      if (!n) nets.set(root, (n = { gpio: [], gnd: false, v33: false, v5: false }));
      return n;
    };
    for (const b of scene.boards) {
      for (const pin of b.pins) {
        const kind = pinKind(pin.label);
        const n = get(u.find(key(pin)));
        if (kind.kind === "gpio") { if (!n.gpio.includes(kind.n)) n.gpio.push(kind.n); }
        else if (kind.kind === "gnd") n.gnd = true;
        else if (kind.kind === "v33") n.v33 = true;
        else if (kind.kind === "v5") n.v5 = true;
      }
    }
    return (p: Pt): Net => nets.get(u.find(key(p))) ?? { gpio: [], gnd: false, v33: false, v5: false };
  };
  const copperNet = tag(copper), signalNet = tag(signal);
  return {
    copper: copperNet,
    signal: signalNet,
    gpioOf: (p) => copperNet(p).gpio[0] ?? signalNet(p).gpio[0],
  };
}

/* ───────────── 장치: 시뮬레이션이 다루는 단위 ───────────── */

/** 장면 속 부품 하나가 시뮬레이션에서 하는 일. part 는 scene.parts 의 번호 */
export type Device =
  | { kind: "led"; part: number; pin: number; color: string }
  | { kind: "rgb"; part: number; r?: number; g?: number; b?: number }
  | { kind: "button"; part: number; pin: number; activeLow: boolean }
  | { kind: "touch"; part: number; pin: number }
  | { kind: "tilt"; part: number; pin: number; activeLow: boolean }
  | { kind: "buzzer"; part: number; pin: number; active: boolean }
  | { kind: "pot"; part: number; pin: number }
  | { kind: "photo"; part: number; pin: number; brighterIsHigher: boolean }
  | { kind: "irrx"; part: number; pin: number }
  | { kind: "servo"; part: number; pin: number }
  | { kind: "ultrasonic"; part: number; trig?: number; echo?: number }
  | { kind: "oled"; part: number }
  | { kind: "rfid"; part: number }
  | { kind: "dht"; part: number; pin: number }
  | { kind: "pir"; part: number; pin: number }
  | { kind: "sound"; part: number; pin: number }
  | { kind: "flame"; part: number; pin: number }
  /** 토양 수분 센서 · 수위 센서 (아날로그 S) */
  | { kind: "soil"; part: number; pin: number }
  | { kind: "water"; part: number; pin: number }
  /** 릴레이 모듈: 입력 S 핀이 1 이면 COM 과 NO 가 이어져 펌프가 돈다 */
  | { kind: "relay"; part: number; pin: number }
  | { kind: "joystick"; part: number; x?: number; y?: number; b?: number }
  | { kind: "keypad"; part: number }
  | { kind: "fan"; part: number; inP?: number; inM?: number }
  | { kind: "seg7"; part: number };

export const legsOf = (p: Part3D): Pt[] => {
  switch (p.type) {
    case "led": return [p.a, p.c];
    case "resistor": case "buzzer": case "photo": case "tilt": return [p.a, p.b];
    case "button": case "pot": case "rgb": case "irrx": return p.legs;
    case "servo": return p.plug;
    case "module": return p.pins;
    case "dip": return [p.l, p.r];
    case "touch": return [p.clip];
    case "seg7": return p.legs;
    case "prop": return [];
  }
};

/** 장면의 부품마다 장치로 읽는다. 핀을 찾지 못한 부품(장식 · 전원만 쓰는 것)은 빠진다 */
export function readDevices(scene: Scene3D, circuit: Circuit = readCircuit(scene)): Device[] {
  const out: Device[] = [];
  const g = circuit.gpioOf;
  /** 스위치의 한쪽 다리가 핀, 다른 쪽이 GND 면 눌렀을 때 0 (풀업), 3V3·5V 면 1 */
  const switchOf = (a: Pt[], b: Pt[]) => {
    const ga = a.map(g).find((n) => n !== undefined), gb = b.map(g).find((n) => n !== undefined);
    const pin = ga ?? gb;
    if (pin === undefined) return undefined;
    const other = ga !== undefined ? b : a;
    const net = circuit.copper(other[0]);
    return { pin, activeLow: !(net.v33 || net.v5) || net.gnd };
  };
  scene.parts.forEach((p, part) => {
    switch (p.type) {
      case "led": {
        const pin = g(p.a);
        if (pin !== undefined) out.push({ kind: "led", part, pin, color: p.color });
        break;
      }
      case "rgb": {
        const [r, , gg, b] = p.legs.map(g);
        if (r !== undefined || gg !== undefined || b !== undefined) out.push({ kind: "rgb", part, r, g: gg, b });
        break;
      }
      case "button": {
        const s = switchOf([p.legs[0], p.legs[2]], [p.legs[1], p.legs[3]]);
        if (s) out.push({ kind: "button", part, ...s });
        break;
      }
      case "tilt": {
        const s = switchOf([p.a], [p.b]);
        if (s) out.push({ kind: "tilt", part, ...s });
        break;
      }
      case "buzzer": {
        const pin = g(p.a) ?? g(p.b);
        if (pin !== undefined) out.push({ kind: "buzzer", part, pin, active: p.active });
        break;
      }
      case "pot": {
        const pin = g(p.legs[1]);
        if (pin !== undefined) out.push({ kind: "pot", part, pin });
        break;
      }
      case "photo": {
        // 포토레지스터 한쪽이 핀(가운데 갈림길), 다른 쪽이 3V3 이면 밝을수록 값이 크다
        const pa = circuit.copper(p.a), pb = circuit.copper(p.b);
        const pin = pa.gpio[0] ?? pb.gpio[0] ?? g(p.a) ?? g(p.b);
        if (pin === undefined) break;
        const other = pa.gpio.length ? pb : pa;
        out.push({ kind: "photo", part, pin, brighterIsHigher: other.v33 || other.v5 });
        break;
      }
      case "irrx": {
        const pin = g(p.legs[0]);
        if (pin !== undefined) out.push({ kind: "irrx", part, pin });
        break;
      }
      case "servo": {
        const pin = g(p.plug[2]);
        if (pin !== undefined) out.push({ kind: "servo", part, pin });
        break;
      }
      case "module": {
        const pin = (name: string) => {
          const q = p.pins.find((x) => x.name === name);
          return q ? g(q) : undefined;
        };
        const s = pin("S") ?? pin("OUT");
        switch (p.kind) {
          case "ultrasonic": out.push({ kind: "ultrasonic", part, trig: pin("Trig"), echo: pin("Echo") }); break;
          case "oled": out.push({ kind: "oled", part }); break;
          case "rfid": out.push({ kind: "rfid", part }); break;
          case "dht": if (s !== undefined) out.push({ kind: "dht", part, pin: s }); break;
          case "pir": if (s !== undefined) out.push({ kind: "pir", part, pin: s }); break;
          case "sound": if (s !== undefined) out.push({ kind: "sound", part, pin: s }); break;
          case "flame": if (s !== undefined) out.push({ kind: "flame", part, pin: s }); break;
          case "soil": if (s !== undefined) out.push({ kind: "soil", part, pin: s }); break;
          case "water": if (s !== undefined) out.push({ kind: "water", part, pin: s }); break;
          case "relay": if (s !== undefined) out.push({ kind: "relay", part, pin: s }); break;
          case "ir": if (s !== undefined) out.push({ kind: "irrx", part, pin: s }); break;
          case "joystick": out.push({ kind: "joystick", part, x: pin("X"), y: pin("Y"), b: pin("B") }); break;
          case "keypad": out.push({ kind: "keypad", part }); break;
          case "fan": out.push({ kind: "fan", part, inP: pin("IN+"), inM: pin("IN−") }); break;
        }
        break;
      }
      case "touch": {
        const pin = g(p.clip);
        if (pin !== undefined) out.push({ kind: "touch", part, pin });
        break;
      }
      case "seg7": out.push({ kind: "seg7", part }); break;
      case "dip": case "resistor": case "prop": break;
    }
  });
  return out;
}
