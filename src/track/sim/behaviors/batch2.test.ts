import { describe, expect, it } from "vitest";
import { behaviorFor } from ".";
import { CARDS, defaultInputs, Simulator } from "../engine";
import { device, run, simFor } from "../testing";

describe("8 · 9 · 10장 출입문", () => {
  it("8장: 등록된 카드면 문이 열리고 LED 가 켜지며, 모르는 카드면 닫히고 꺼진다", () => {
    const sim = simFor("08-access-control");
    run(sim, 1.5);
    expect(sim.outputs.servo[4]).toBe(0);
    sim.inputs.card = CARDS.known;
    run(sim, 0.5);
    expect(sim.outputs.servo[4]).toBe(180);
    expect(sim.outputs.pins[26]).toBe(1);
    expect(sim.outputs.serial.at(-1)).toBe(`Card UID: ${CARDS.known}`);
    sim.inputs.card = CARDS.unknown;
    run(sim, 1.2);
    expect(sim.outputs.servo[4]).toBe(0);
    expect(sim.outputs.pins[26]).toBe(0);
    expect(sim.outputs.serial.at(-1)).toBe(`Card UID: ${CARDS.unknown}`);
  });

  it("9장: 등록된 카드면 Close: 3 · 2 · 1 을 세고 문을 닫는다, 모르는 카드는 DENIED", () => {
    const sim = simFor("09-oled-access");
    run(sim, 0.5);
    expect(sim.outputs.oled).toEqual(["Tag your", "card..."]);
    sim.inputs.card = CARDS.known;
    run(sim, 0.1);
    sim.inputs.card = null;
    expect(sim.outputs.servo[4]).toBe(180);
    expect(sim.outputs.oled).toEqual(["OPEN", "Close: 3"]);
    run(sim, 1.5);
    expect(sim.outputs.oled).toEqual(["OPEN", "Close: 2"]);
    run(sim, 2);
    expect(sim.outputs.servo[4]).toBe(0);
    expect(sim.outputs.oled).toEqual(["Tag your", "card..."]);
    sim.inputs.card = CARDS.unknown;
    run(sim, 0.1);
    sim.inputs.card = null;
    expect(sim.outputs.oled).toEqual(["DENIED", "Unknown card"]);
    expect(sim.outputs.servo[4]).toBe(0);
    run(sim, 3.2);
    expect(sim.outputs.oled).toEqual(["Tag your", "card..."]);
  });

  it("10장: 거리를 화면에 보여 주고, 15cm 안으로 오면 문을 3초 연다", () => {
    const sim = simFor("10-auto-door");
    const sonar = device(sim, "ultrasonic");
    sim.inputs.distance[sonar.part] = 30;
    run(sim, 3);
    expect(sim.outputs.oled?.[0]).toBe("AUTO DOOR");
    expect(sim.outputs.oled?.[1]).toMatch(/^(29|30) cm$/);
    expect(sim.outputs.servo[4]).toBe(0);
    sim.inputs.distance[sonar.part] = 8;
    run(sim, 0.5);
    expect(sim.outputs.servo[4]).toBe(180);
    expect(sim.outputs.oled).toEqual(["DOOR OPEN", "Welcome"]);
    sim.inputs.distance[sonar.part] = 30;
    run(sim, 3.2);
    expect(sim.outputs.servo[4]).toBe(0);
    expect(sim.outputs.oled).toEqual(["DOOR CLOSE", "Bye~"]);
  });
});

describe("18 · 19장 서보", () => {
  it("18장: 가변저항 손잡이를 돌린 만큼 서보가 돈다", () => {
    const sim = simFor("18-servo");
    const pot = device(sim, "pot");
    sim.inputs.knob[pot.part] = 0;
    run(sim, 0.2);
    expect(sim.outputs.servo[4]).toBeLessThanOrEqual(1);
    sim.inputs.knob[pot.part] = 1;
    run(sim, 0.2);
    expect(sim.outputs.servo[4]).toBeGreaterThanOrEqual(179);
    sim.inputs.knob[pot.part] = 0.5;
    run(sim, 0.2);
    expect(Math.abs(sim.outputs.servo[4] - 90)).toBeLessThanOrEqual(2);
  });

  it("19장: 조이스틱을 오른쪽으로 밀면 각도가 조금씩 커지고, 가운데면 멈춘다", () => {
    const sim = simFor("19-joystick");
    const joy = device(sim, "joystick");
    run(sim, 0.5);
    expect(sim.outputs.servo[4]).toBe(90);
    sim.inputs.joy[joy.part] = { x: 1, y: 0, pressed: false };
    run(sim, 1);
    const right = sim.outputs.servo[4];
    expect(right).toBeGreaterThan(125);
    expect(right).toBeLessThan(155);
    sim.inputs.joy[joy.part] = { x: 0, y: 0, pressed: false };
    run(sim, 1);
    expect(sim.outputs.servo[4]).toBe(right);
    sim.inputs.joy[joy.part] = { x: -1, y: 0, pressed: false };
    run(sim, 5);
    expect(sim.outputs.servo[4]).toBe(0);
  });
});

describe("20 · 21 · 22장", () => {
  it("20장: 리모컨 OK 를 누르면 2번 LED 가 켜지고 다른 단추면 꺼진다", () => {
    const sim = new Simulator(
      [
        { kind: "irrx", part: 0, pin: 5 },
        { kind: "led", part: 1, pin: 2, color: "#e03131" },
      ],
      behaviorFor("20-keypad-ir"),
      defaultInputs(),
    );
    run(sim, 0.5);
    expect(sim.outputs.pins[2] ?? 0).toBe(0);
    sim.inputs.ir.push("OK");
    run(sim, 0.3);
    expect(sim.outputs.pins[2]).toBe(1);
    run(sim, 1);
    expect(sim.outputs.pins[2]).toBe(1);
    sim.inputs.ir.push("3");
    run(sim, 0.3);
    expect(sim.outputs.pins[2]).toBe(0);
  });

  it("21장: 이름표 화면의 수가 1초마다 하나씩 커진다", () => {
    const sim = simFor("21-oled");
    run(sim, 0.1);
    expect(sim.outputs.oled).toEqual(["HELLO, I AM", "MINJI", "0"]);
    run(sim, 2);
    expect(sim.outputs.oled).toEqual(["HELLO, I AM", "MINJI", "2"]);
  });

  it("22장: 등록된 카드면 2번 LED 가 1초 켜졌다 꺼지고, 모르는 카드는 그대로", () => {
    const sim = simFor("22-rfid");
    sim.inputs.card = CARDS.unknown;
    run(sim, 1);
    expect(sim.outputs.pins[2] ?? 0).toBe(0);
    sim.inputs.card = CARDS.known;
    run(sim, 0.2);
    sim.inputs.card = null;
    expect(sim.outputs.pins[2]).toBe(1);
    run(sim, 1.2);
    expect(sim.outputs.pins[2]).toBe(0);
  });
});

describe("23 · 24장 버튼", () => {
  const rgb = (sim: Simulator) => [sim.outputs.pins[27], sim.outputs.pins[25], sim.outputs.pins[26]];

  it("23장: 길게 누르면 파랑, 짧게 한 번은 빨강, 두 번은 초록", () => {
    const sim = simFor("23-button-king");
    const btn = device(sim, "button");
    const press = (sec: number) => {
      sim.inputs.pressed[btn.part] = true;
      run(sim, sec);
      sim.inputs.pressed[btn.part] = false;
    };
    run(sim, 0.2);
    press(0.8);
    run(sim, 0.2);
    expect(rgb(sim)).toEqual([0, 0, 1]);
    press(0.1);
    run(sim, 0.2);
    expect(rgb(sim)).toEqual([0, 0, 1]); // 0.4초가 지나기 전에는 아직
    run(sim, 0.4);
    expect(rgb(sim)).toEqual([1, 0, 0]);
    press(0.1);
    run(sim, 0.15);
    press(0.1);
    run(sim, 0.7);
    expect(rgb(sim)).toEqual([0, 1, 0]);
  });

  it("24장: 버튼을 누를 때마다 2번 LED 가 켜졌다 꺼졌다 바뀐다", () => {
    const sim = simFor("24-interrupt");
    const btn = device(sim, "button");
    run(sim, 0.3);
    expect(sim.outputs.pins[2] ?? 0).toBe(0);
    sim.inputs.pressed[btn.part] = true;
    run(sim, 0.5);
    expect(sim.outputs.pins[2]).toBe(1);
    sim.inputs.pressed[btn.part] = false;
    run(sim, 0.3);
    expect(sim.outputs.pins[2]).toBe(1);
    sim.inputs.pressed[btn.part] = true;
    run(sim, 0.2);
    expect(sim.outputs.pins[2]).toBe(0);
  });
});

describe("25 · 26장 웹서버", () => {
  it("25장: 폰 단추로 LED 를 켜고 끄고, blink 면 세 번 깜빡인 뒤 답한다", () => {
    const sim = simFor("25-web-led");
    run(sim, 1.5);
    expect(sim.outputs.serial).toEqual(["IP: 192.168.0.5", "http://192.168.0.5"]);
    expect(sim.outputs.phone?.buttons.map((x) => x.path)).toEqual(["/cmd?led=on", "/cmd?led=off", "/cmd?led=blink"]);
    sim.inputs.web.push("/cmd?led=on");
    run(sim, 0.1);
    expect(sim.outputs.pins[2]).toBe(1);
    expect(sim.outputs.phone?.lines).toEqual(["on"]);
    sim.inputs.web.push("/cmd?led=blink");
    run(sim, 0.1);
    expect(sim.outputs.pins[2]).toBe(1);
    run(sim, 0.3);
    expect(sim.outputs.pins[2]).toBe(0);
    expect(sim.outputs.phone?.lines).toEqual(["on"]); // 깜빡이는 동안은 아직 답하지 않는다
    run(sim, 1.6);
    expect(sim.outputs.pins[2]).toBe(0);
    expect(sim.outputs.phone?.lines).toEqual(["blink"]);
    sim.inputs.web.push("/cmd?led=off");
    run(sim, 0.1);
    expect(sim.outputs.phone?.lines).toEqual(["off"]);
  });

  it("26장: 상황판이 온습도를 보여 주고, 28도보다 더우면 2초 안에 HOT 으로 바뀐다", () => {
    const sim = simFor("26-web-sensors");
    run(sim, 1.5);
    expect(sim.outputs.serial).toEqual(["IP: 192.168.0.5", "192.168.0.5"]);
    expect(sim.outputs.phone).toEqual({ title: "교실 상황판", buttons: [], lines: ["OK", "T: 24C", "H: 45%"] });
    sim.inputs.temp = 31;
    run(sim, 2.1);
    expect(sim.outputs.phone?.lines).toEqual(["HOT", "T: 31C", "H: 45%"]);
    sim.inputs.web.push("/data");
    run(sim, 0.1);
    expect(sim.outputs.phone?.lines).toEqual(['{"temp": 31, "hum": 45}']);
  });
});
