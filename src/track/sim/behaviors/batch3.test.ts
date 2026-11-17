import { afterEach, describe, expect, it, vi } from "vitest";
import type { Device } from "../circuit";
import { defaultInputs, Simulator } from "../engine";
import { device, run, simFor } from "../testing";
import { behaviorFor } from ".";

/** sec 초 동안 돌리며 화면마다 f() 를 모은다 (잠깐 울린 부저음 같은 것을 놓치지 않게) */
function seen<T>(sim: Simulator, sec: number, f: () => T): T[] {
  const out: T[] = [];
  for (let t = 0; t < sec; t += 1 / 60) {
    sim.step(1 / 60);
    out.push(f());
  }
  return out;
}

/** 버튼 · 터치를 잠깐 눌렀다 뗀다 */
function tap(sim: Simulator, part: number, hold = 0.15, after = 0.15) {
  sim.inputs.pressed[part] = true;
  run(sim, hold);
  sim.inputs.pressed[part] = false;
  run(sim, after);
}

const make = (id: string, devices: Device[]) => new Simulator(devices, behaviorFor(id), defaultInputs());

afterEach(() => vi.restoreAllMocks());

describe("31~43 · 90장 동작", () => {
  it("31장: A 로 켜고 B 로 단계를 올리며, 손이 8cm 안에 오면 선풍기가 멈춘다", () => {
    const sim = make("31-safe-fan", [
      { kind: "fan", part: 0, inP: 13, inM: 12 },
      { kind: "button", part: 1, pin: 14, activeLow: true },
      { kind: "button", part: 2, pin: 27, activeLow: true },
      { kind: "led", part: 3, pin: 25, color: "#e03131" },
      { kind: "led", part: 4, pin: 26, color: "#e03131" },
      { kind: "led", part: 5, pin: 33, color: "#e03131" },
      { kind: "ultrasonic", part: 6, trig: 18, echo: 19 },
    ]);
    run(sim, 0.5);
    expect(sim.outputs.pins[13]).toBe(0);
    tap(sim, 1);
    expect(sim.outputs.pins[13]).toBeCloseTo(300 / 1023);
    expect([sim.outputs.pins[25], sim.outputs.pins[26], sim.outputs.pins[33]]).toEqual([1, 0, 0]);
    tap(sim, 2);
    tap(sim, 2);
    expect(sim.outputs.pins[13]).toBeCloseTo(900 / 1023);
    expect([sim.outputs.pins[25], sim.outputs.pins[26], sim.outputs.pins[33]]).toEqual([1, 1, 1]);
    expect(sim.outputs.serial.at(-1)).toMatch(/^(39|40) 900$/);
    sim.inputs.distance[6] = 5;
    run(sim, 0.3);
    expect(sim.outputs.pins[13]).toBe(0);
    expect(sim.outputs.pins[25]).toBe(0);
  });

  it("32장: 가까우면 880Hz 삐, 누우면 1319Hz, 어두우면 LED 깜빡", () => {
    const sim = simFor("32-smart-cane");
    const sonar = device(sim, "ultrasonic");
    run(sim, 2.5);
    expect(seen(sim, 2, () => sim.outputs.tone[25] ?? 0).every((hz) => hz === 0)).toBe(true);
    sim.inputs.distance[sonar.part] = 10;
    expect(seen(sim, 2, () => sim.outputs.tone[25])).toContain(880);
    sim.inputs.distance[sonar.part] = 60;
    sim.inputs.tilted[device(sim, "tilt").part] = true;
    expect(seen(sim, 2, () => sim.outputs.tone[25])).toContain(1319);
    sim.inputs.tilted[device(sim, "tilt").part] = false;
    sim.inputs.covered[device(sim, "photo").part] = true;
    expect(seen(sim, 2, () => sim.outputs.pins[26])).toContain(1);
  });

  it("33장: 불쾌지수가 높으면 빨강 · 팬, 낮으면 초록 · 멈춤", () => {
    const sim = simFor("33-room-climate");
    sim.inputs.temp = 30;
    sim.inputs.humidity = 70;
    run(sim, 0.5);
    expect(sim.outputs.oled).toEqual(["", "T: 30C", "H: 70%", "DI: 81"]);
    expect([sim.outputs.pins[27], sim.outputs.pins[25], sim.outputs.pins[13]]).toEqual([1, 0, 1]);
    sim.inputs.temp = 22;
    sim.inputs.humidity = 40;
    run(sim, 2);
    expect(sim.outputs.oled?.[3]).toBe("DI: 67");
    expect([sim.outputs.pins[27], sim.outputs.pins[25], sim.outputs.pins[13]]).toEqual([0, 1, 0]);
  });

  it("34장: 빛을 가리면 DARK · LED 100%, 밝으면 BRIGHT · 꺼짐", () => {
    const sim = simFor("34-street-lamp");
    run(sim, 0.6);
    expect(sim.outputs.oled).toEqual(["BRIGHT", "LED 0%"]);
    expect(sim.outputs.pins[26]).toBe(0);
    sim.inputs.covered[device(sim, "photo").part] = true;
    run(sim, 0.6);
    expect(sim.outputs.oled).toEqual(["DARK", "LED 100%"]);
    expect(sim.outputs.pins[26]).toBe(1);
  });

  it("35장: 손이 20cm 안일 때 버튼을 누르면 WIN 90도 · FAIL 50도, 쉬면 180도", () => {
    const sim = simFor("35-random-hammer");
    const sonar = device(sim, "ultrasonic"), button = device(sim, "button");
    run(sim, 2.5);
    expect(sim.outputs.oled).toEqual(["", "HAMMER", "1 in 3"]);
    expect(sim.outputs.servo[4]).toBe(180);
    sim.inputs.distance[sonar.part] = 10;
    vi.spyOn(Math, "random").mockReturnValue(0);
    sim.inputs.pressed[button.part] = true;
    run(sim, 0.3);
    sim.inputs.pressed[button.part] = false;
    expect(sim.outputs.oled).toEqual(["", "WIN", "1 in 3"]);
    expect(sim.outputs.servo[4]).toBe(90);
    run(sim, 1);
    expect(sim.outputs.servo[4]).toBe(180);
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    tap(sim, button.part, 0.2, 0.1);
    expect(sim.outputs.oled?.[1]).toBe("FAIL");
    expect(sim.outputs.servo[4]).toBe(50);
  });

  it("36장: 시작 → 문제 → 맞히면 OK, 틀리면 END 와 점수", () => {
    const sim = make("36-memory-game", [
      { kind: "button", part: 0, pin: 14, activeLow: true },
      { kind: "touch", part: 1, pin: 32 },
      { kind: "touch", part: 2, pin: 33 },
      { kind: "touch", part: 3, pin: 27 },
      { kind: "oled", part: 4 },
    ]);
    vi.spyOn(Math, "random").mockReturnValue(0);
    run(sim, 0.5);
    expect(sim.outputs.oled).toEqual(["", "PRESS START"]);
    tap(sim, 0, 0.1, 0.1);
    expect(sim.outputs.oled).toEqual(["", "A"]);
    run(sim, 2.5);
    for (let k = 0; k < 3; k++) tap(sim, 1);
    expect(sim.outputs.oled).toEqual(["", "OK"]);
    run(sim, 1 + 4 * 0.7 + 0.2);
    for (let k = 0; k < 4; k++) tap(sim, 2);
    expect(sim.outputs.oled).toEqual(["", "END", "SCORE 1"]);
  });

  it("37장: 폰 단추로 색 · 손잡이 모드 · 끄기", () => {
    const sim = simFor("37-mood-light");
    run(sim, 0.2);
    expect(sim.outputs.phone?.title).toBe("Mood Light");
    expect(sim.outputs.serial).toContain("192.168.0.23");
    sim.inputs.web.push("/cmd?c=red");
    run(sim, 0.2);
    expect([sim.outputs.pins[27], sim.outputs.pins[25], sim.outputs.pins[26]]).toEqual([1, 0, 0]);
    expect(sim.outputs.phone?.lines).toEqual(["모드 2", "지금 색 red"]);
    sim.inputs.knob[device(sim, "pot").part] = 0.95;
    sim.inputs.web.push("/cmd?c=knob");
    run(sim, 0.2);
    expect([sim.outputs.pins[27], sim.outputs.pins[25], sim.outputs.pins[26]]).toEqual([1, 1, 1]);
    sim.inputs.web.push("/cmd?c=off");
    run(sim, 0.2);
    expect([sim.outputs.pins[27], sim.outputs.pins[25], sim.outputs.pins[26]]).toEqual([0, 0, 0]);
  });

  it("38장: 불꽃 + 27도면 FIRE 경보, 기울면 QUAKE, 출구 알리기면 660Hz", () => {
    const sim = simFor("38-disaster-alarm");
    run(sim, 0.5);
    expect(sim.outputs.phone?.lines[0]).toBe("상태 OK");
    sim.inputs.flame = true;
    sim.inputs.temp = 30;
    expect(seen(sim, 2.5, () => sim.outputs.tone[25])).toContain(880);
    expect(sim.outputs.serial).toContain("FIRE");
    expect(sim.outputs.phone?.lines).toEqual(["상태 FIRE", "온도 30°C"]);
    sim.inputs.flame = false;
    sim.inputs.tilted[device(sim, "tilt").part] = true;
    run(sim, 2.5);
    expect(sim.outputs.phone?.lines[0]).toBe("상태 QUAKE");
    sim.inputs.tilted[device(sim, "tilt").part] = false;
    run(sim, 2.5);
    sim.inputs.web.push("/cmd?exit=1");
    expect(seen(sim, 1.5, () => sim.outputs.tone[25])).toContain(660);
  });

  it("39장: OLED 페이지 1 은 빛 · 소리 · 손잡이, 앱의 페이지 2 단추면 온습도 · 틸트 · PIR", () => {
    const sim = simFor("39-sensor-board");
    run(sim, 0.5);
    expect(sim.outputs.oled?.map((l) => l.slice(0, 3))).toEqual(["L: ", "S: ", "K: "]);
    expect(sim.outputs.phone?.title).toBe("Sensor Board");
    sim.inputs.motion = true;
    sim.inputs.temp = 29;
    run(sim, 2);
    sim.inputs.web.push("/cmd?page=2");
    run(sim, 0.2);
    expect(sim.outputs.oled).toEqual(["T: 29C", "H: 45%", "TILT: 0", "PIR: 1"]);
  });

  it("40장: 사람이 10cm 안이면 초록 · 차단기 90도 · 1000Hz, 멀면 빨강 · 0도", () => {
    const sim = make("40-crosswalk", [
      { kind: "rgb", part: 0, r: 27, g: 25, b: 26 },
      { kind: "buzzer", part: 1, pin: 16, active: false },
      { kind: "ultrasonic", part: 2, trig: 13, echo: 12 },
      { kind: "servo", part: 3, pin: 4 },
    ]);
    run(sim, 2.5);
    expect([sim.outputs.pins[27], sim.outputs.pins[25], sim.outputs.servo[4]]).toEqual([1, 0, 0]);
    sim.inputs.distance[2] = 5;
    expect(seen(sim, 1, () => sim.outputs.tone[16])).toContain(1000);
    expect([sim.outputs.pins[27], sim.outputs.pins[25], sim.outputs.servo[4]]).toEqual([0, 1, 90]);
    expect(sim.outputs.serial.at(-1)).toMatch(/^[45] cm$/);
  });

  it("41장: 버튼으로 칸을 옮기고, 가만히 있으면 폭탄에 맞아 END", () => {
    const sim = simFor("41-bomb-game");
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    run(sim, 0.05);
    expect(sim.outputs.oled?.[4]).toBe(". . @ . .");
    expect(sim.outputs.oled?.[1]).toBe("# . # . #");
    const tones = seen(sim, 6, () => sim.outputs.tone[25]);
    expect(sim.outputs.oled?.slice(0, 2)).toEqual(["", "END"]);
    expect(sim.outputs.oled?.[2]).toMatch(/^SCORE \d+$/);
    expect(tones).toContain(220);
  });

  it("41장: B 버튼을 누르면 내가 오른쪽 칸으로", () => {
    const sim = simFor("41-bomb-game");
    const b = device(sim, "button");
    const right = sim.devices.find((d) => d.kind === "button" && d.pin === 27)!.part;
    expect(b.pin).toBe(14);
    run(sim, 0.05);
    sim.inputs.pressed[right] = true;
    run(sim, 0.12);
    sim.inputs.pressed[right] = false;
    expect(sim.outputs.oled?.[4].replace(/[#X]/g, ".")).toMatch(/^\. \. \. [@X] \.$/);
  });

  it("42장: 버튼으로 시작 · 점프(880Hz), 벽돌에 부딪히면 GAME OVER(220Hz)", () => {
    const sim = simFor("42-runner-game");
    const button = device(sim, "button");
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(seen(sim, 1.2, () => sim.outputs.oled?.[1])).toContain("PRESS START");
    tap(sim, button.part, 0.05, 0.3);
    expect(sim.outputs.oled?.[0]).toMatch(/^SCORE \d+$/);
    sim.inputs.pressed[button.part] = true;
    const jump = seen(sim, 0.3, () => sim.outputs.tone[25]);
    sim.inputs.pressed[button.part] = false;
    expect(jump).toContain(880);
    rnd.mockReturnValue(0);
    const crash = seen(sim, 4, () => [sim.outputs.tone[25], sim.outputs.oled?.[1]]);
    expect(crash.map(([hz]) => hz)).toContain(220);
    expect(crash.map(([, line]) => line)).toContain("GAME OVER");
  });

  it("43장: 시작하면 BLANK, 사람이 오면 SMILE(523Hz), 너무 더우면 BAD(262Hz)", () => {
    const sim = simFor("43-chick");
    const button = sim.devices.find((d) => d.kind === "button")!;
    run(sim, 0.5);
    expect(sim.outputs.oled).toEqual(["", "You Like Chick?", "PRESS START"]);
    tap(sim, button.part, 0.2, 0.1);
    expect(sim.outputs.oled?.[0]).toBe("S: BLANK");
    sim.inputs.motion = true;
    const smile = seen(sim, 2.5, () => sim.outputs.tone[25]);
    expect(smile).toContain(523);
    expect(sim.outputs.oled?.[0]).toBe("S: SMILE");
    sim.inputs.temp = 33;
    const bad = seen(sim, 2.5, () => sim.outputs.tone[25]);
    expect(bad).toContain(262);
    expect(sim.outputs.oled?.slice(0, 2)).toEqual(["S: BAD", "T: 33C"]);
  });

  it("90 체험: 평소 초록, 버튼을 누르면 노랑 1초 → 빨강 8초 → 초록", () => {
    const sim = simFor("90-first-signal");
    run(sim, 0.5);
    expect([sim.outputs.pins[13] ?? 0, sim.outputs.pins[14] ?? 0, sim.outputs.pins[16]]).toEqual([0, 0, 1]);
    tap(sim, device(sim, "button").part, 0.15, 0.1);
    expect([sim.outputs.pins[14], sim.outputs.pins[16]]).toEqual([1, 0]);
    run(sim, 1);
    expect([sim.outputs.pins[13], sim.outputs.pins[14]]).toEqual([1, 0]);
    run(sim, 7);
    expect(sim.outputs.pins[13]).toBe(1);
    run(sim, 1.2);
    expect([sim.outputs.pins[13], sim.outputs.pins[16]]).toEqual([0, 1]);
  });
});
