import { describe, expect, it } from "vitest";
import type { Device } from "../circuit";
import { defaultInputs, Simulator } from "../engine";
import { device, run, simFor } from "../testing";
import { behaviorFor } from "./index";

/** 3D 장면이 아직 없는 챕터: 장치를 직접 적어 만든다 */
const simOf = (id: string, devices: Device[]) => new Simulator(devices, behaviorFor(id), defaultInputs());

describe("2 · 4 · 5 · 6 · 7장 동작 (출력)", () => {
  it("2장: 26번 LED 가 3초 동안 밝아졌다가 3초 동안 어두워진다", () => {
    const sim = simFor("02-breathing-led");
    run(sim, 0.5);
    const a = sim.outputs.pins[26];
    run(sim, 2);
    const top = sim.outputs.pins[26];
    expect(top).toBeGreaterThan(a);
    expect(top).toBeGreaterThan(0.75);
    run(sim, 2.5);
    expect(sim.outputs.pins[26]).toBeLessThan(top);
    expect(sim.outputs.pins[26]).toBeLessThan(0.4);
  });

  it("4장: 처음엔 0.3초씩, 나중엔 0.1초씩 LED 하나만 켜져 흐른다", () => {
    const sim = simFor("04-flowing-light");
    const lit = () => [18, 5, 14, 17, 26].filter((p) => sim.outputs.pins[p] === 1);
    run(sim, 0.1);
    expect(lit()).toEqual([18]);
    run(sim, 0.3);
    expect(lit()).toEqual([5]);
    run(sim, 2.15); // 2.55초: 0.1초 흐름의 첫 칸
    expect(lit()).toEqual([18]);
    run(sim, 0.1);
    expect(lit()).toEqual([5]);
  });

  it("5장: 빨강 → 주황 → 노랑 … 0.5초마다 색이 바뀐다", () => {
    const sim = simOf("05-rgb-led", [{ kind: "rgb", part: 0, r: 27, g: 25, b: 26 }]);
    const rgb = () => [27, 25, 26].map((p) => Math.round((sim.outputs.pins[p] ?? 0) * 1023));
    run(sim, 0.2);
    expect(rgb()).toEqual([1023, 0, 0]);
    run(sim, 0.5);
    expect(rgb()).toEqual([1023, 513, 0]);
    run(sim, 1.5);
    expect(rgb()).toEqual([0, 0, 1023]);
  });

  it("6장: 3 · 2 · 1 · 0 을 보인 뒤 꺼진다", () => {
    const sim = simOf("06-seven-segment", [{ kind: "seg7", part: 0 }]);
    run(sim, 0.5);
    expect(sim.outputs.seg7).toBe("3");
    run(sim, 1);
    expect(sim.outputs.seg7).toBe("2");
    run(sim, 2);
    expect(sim.outputs.seg7).toBe("0.");
    run(sim, 2);
    expect(sim.outputs.seg7).toBeNull();
  });

  it("7장: 약하게 → 세게 → 멈춤 → 거꾸로 → 멈춤", () => {
    const sim = simFor("07-fan", "devkit");
    const fan = device(sim, "fan");
    const speed = () => (sim.outputs.pins[fan.inP!] ?? 0) - (sim.outputs.pins[fan.inM!] ?? 0);
    run(sim, 1);
    expect(speed()).toBeCloseTo(500 / 1023);
    run(sim, 3);
    expect(speed()).toBe(1);
    run(sim, 2.5);
    expect(speed()).toBe(0);
    run(sim, 1);
    expect(speed()).toBe(-1);
    run(sim, 3);
    expect(speed()).toBe(0);
  });
});

describe("11 · 12 · 13 · 14 · 15 · 16장 동작 (입력 → 출력)", () => {
  it("11장: 시작 터치 값을 찍고, 호일을 만지면 26번 LED 가 켜진다", () => {
    const sim = simOf("11-button-touch", [
      { kind: "button", part: 0, pin: 14, activeLow: true },
      { kind: "touch", part: 1, pin: 4 },
      { kind: "led", part: 2, pin: 26, color: "#e03131" },
    ]);
    run(sim, 0.5);
    expect(Number(sim.outputs.serial[0])).toBeGreaterThan(500);
    expect(sim.outputs.pins[26]).toBe(0);
    sim.inputs.pressed[1] = true;
    run(sim, 0.3);
    expect(sim.outputs.pins[26]).toBe(1);
    sim.inputs.pressed[1] = false;
    run(sim, 0.3);
    expect(sim.outputs.pins[26]).toBe(0);
  });

  it("12장: 25번 부저가 도부터 0.3초씩 올라갔다 내려오고 조용해진다", () => {
    const sim = simFor("12-melody-buzzer");
    const buzzer = device(sim, "buzzer");
    run(sim, 0.1);
    expect(sim.outputs.tone[buzzer.pin]).toBe(262);
    run(sim, 2.2); // 2.3초: 여덟째 음 (높은 도)
    expect(sim.outputs.tone[buzzer.pin]).toBe(523);
    run(sim, 2.3); // 4.6초: 마지막 도
    expect(sim.outputs.tone[buzzer.pin]).toBe(262);
    run(sim, 0.5);
    expect(sim.outputs.tone[buzzer.pin]).toBe(0);
  });

  it("13장: 박수로 켜고 끄고, 켜 둔 동안 다이얼로 밝기를 바꾼다", () => {
    const sim = simFor("13-clap-dial");
    const knob = device(sim, "pot");
    const clap = () => { sim.inputs.sound = 0.9; run(sim, 0.1); sim.inputs.sound = 0; run(sim, 0.5); };
    sim.inputs.knob[knob.part] = 1;
    run(sim, 0.5);
    expect(sim.outputs.pins[26]).toBe(0);
    clap();
    expect(sim.outputs.pins[26]).toBeGreaterThan(0.95);
    expect(sim.outputs.serial.at(-1)).toBe("clap 1");
    sim.inputs.knob[knob.part] = 0.25;
    run(sim, 0.1);
    expect(sim.outputs.pins[26]).toBeGreaterThan(0.2);
    expect(sim.outputs.pins[26]).toBeLessThan(0.3);
    clap();
    expect(sim.outputs.pins[26]).toBe(0);
    expect(sim.outputs.serial.at(-1)).toBe("clap 2");
  });

  it("14장: 센서를 가려 어두워지면 LED 가 밝아진다", () => {
    const sim = simFor("14-light-sensor");
    const photo = device(sim, "photo");
    run(sim, 0.5);
    const day = sim.outputs.pins[26];
    expect(day).toBeLessThan(0.2);
    sim.inputs.covered[photo.part] = true;
    run(sim, 0.5);
    expect(sim.outputs.pins[26]).toBeGreaterThan(0.6);
    expect(Number(sim.outputs.serial.at(-1))).toBeGreaterThan(60);
  });

  it("15장: 덥고 축축해 불쾌지수가 75 이상이면 LED 가 켜진다", () => {
    const sim = simFor("15-temp-humidity");
    run(sim, 0.5);
    expect(sim.outputs.serial.at(-1)).toBe("69.997");
    expect(sim.outputs.pins[26]).toBe(0);
    sim.inputs.temp = 32;
    sim.inputs.humidity = 80;
    run(sim, 2);
    expect(sim.outputs.serial.at(-1)).toBe("86.124");
    expect(sim.outputs.pins[26]).toBe(1);
  });

  it("16장: 기울이면 LED 와 부저 경보, 3초 뒤부터 사람이 오면 복도 등이 켜지고 5초 뒤 꺼진다", () => {
    const sim = simFor("16-tilt-pir");
    const tilt = device(sim, "tilt");
    sim.inputs.tilted[tilt.part] = true;
    run(sim, 0.1);
    expect(sim.outputs.pins[26]).toBe(1);
    expect(sim.outputs.pins[25]).toBe(1);
    run(sim, 0.25);
    expect(sim.outputs.pins[25]).toBe(0);
    sim.inputs.tilted[tilt.part] = false;
    run(sim, 0.2);
    expect(sim.outputs.pins[26]).toBe(0);
    sim.inputs.motion = true;
    run(sim, 3);
    expect(sim.outputs.pins[26]).toBe(1);
    sim.inputs.motion = false;
    run(sim, 4);
    expect(sim.outputs.pins[26]).toBe(1);
    run(sim, 1.5);
    expect(sim.outputs.pins[26]).toBe(0);
  });
});
