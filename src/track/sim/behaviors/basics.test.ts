import { describe, expect, it } from "vitest";
import { device, run, simFor } from "../testing";

describe("1 · 3 · 17장 동작", () => {
  it("1장: 26번 LED 가 2초 켜지고 1초 꺼진다", () => {
    const sim = simFor("01-led");
    run(sim, 1);
    expect(sim.outputs.pins[26]).toBe(1);
    run(sim, 1.5);
    expect(sim.outputs.pins[26]).toBe(0);
    run(sim, 1);
    expect(sim.outputs.pins[26]).toBe(1);
  });

  it("3장: 빨강 5초 → 노랑 깜빡 → 초록", () => {
    const sim = simFor("03-traffic-light");
    run(sim, 2);
    expect([sim.outputs.pins[13], sim.outputs.pins[14] ?? 0]).toEqual([1, 0]);
    run(sim, 3.25);
    expect([sim.outputs.pins[13], sim.outputs.pins[14]]).toEqual([0, 1]);
    run(sim, 5.5);
    expect(sim.outputs.pins[16]).toBe(1);
  });

  it("17장: 자동차가 15cm 보다 가까우면 LED 가 켜지고, 거리를 시리얼에 찍는다", () => {
    const sim = simFor("17-ultrasonic");
    const sonar = device(sim, "ultrasonic");
    sim.inputs.distance[sonar.part] = 30;
    run(sim, 3);
    expect(sim.outputs.pins[26]).toBe(0);
    expect(sim.outputs.serial.at(-1)).toMatch(/^(29|30) cm$/);
    sim.inputs.distance[sonar.part] = 8;
    run(sim, 1);
    expect(sim.outputs.pins[26]).toBe(1);
  });
});
