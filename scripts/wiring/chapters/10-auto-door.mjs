// 융합 F3 "다가가면 열리는 자동문" — 모듈 셋을 브레드보드 없이 F-F 듀폰선·서보 플러그로 보드에 바로 꽂는다.
import { LANE, board, compose, connectionTable, ffWire, name, oled, pin, servo, svgDoc, ultrasonic } from "../esp32plus.mjs";

const RED = "#e03131", BLACK = "#343a40", YELLOW = "#f59f00", GREEN = "#2f9e44", BLUE = "#1971c2", PURPLE = "#7048e8";
const BROWN = "#8b5a2b", ORANGE = "#f76707";

function ultrasonicPart() {
  const u = ultrasonic(150, 22);
  return {
    svg: [u.svg, name(138, 56, "초음파 센서", "end")].join("\n  "),
    wires: [
      ffWire(u.pins.VCC, pin("top:5V"), RED),
      ffWire(u.pins.GND, pin("top:GND"), BLACK),
      ffWire(u.pins.Trig, pin("top:io13"), YELLOW),
      ffWire(u.pins.Echo, pin("top:io12"), GREEN),
    ],
    used: ["top:5V", "top:GND", "top:io13", "top:io12"],
    rows: [
      { color: RED, part: "초음파 VCC", to: "5V" },
      { color: BLACK, part: "초음파 GND", to: "GND" },
      { color: YELLOW, part: "초음파 Trig", to: "io13" },
      { color: GREEN, part: "초음파 Echo", to: "io12" },
    ],
  };
}

function oledPart() {
  const o = oled(528, 312);
  // 화면 위쪽 핀에서 조금 올라가 보드의 가로 빈 띠(위 G 줄과 ESP32 모듈 사이)를 지나 I2C 핀에 위에서 꽂힌다
  const t = { GND: pin("i2c:GND:0"), VCC: pin("i2c:5V:0"), SDA: pin("i2c:SDA:0"), SCL: pin("i2c:SCL:0") };
  const lane = { GND: LANE.top + 3, VCC: LANE.top + 8, SDA: LANE.top + 13, SCL: LANE.top + 18 };
  const route = (k) => [{ x: o.pins[k].x, y: lane[k] }, { x: t[k].x, y: lane[k] }];
  return {
    svg: [o.svg, name(582, 440, "OLED 화면")].join("\n  "),
    wires: [
      ffWire(o.pins.GND, t.GND, BLACK, route("GND"), "orth"),
      ffWire(o.pins.VCC, t.VCC, RED, route("VCC"), "orth"),
      ffWire(o.pins.SDA, t.SDA, BLUE, route("SDA"), "orth"),
      ffWire(o.pins.SCL, t.SCL, PURPLE, route("SCL"), "orth"),
    ],
    used: ["i2c:GND:0", "i2c:5V:0", "i2c:SDA:0", "i2c:SCL:0"],
    rows: [
      { colors: [BLACK, RED], part: "OLED GND · VCC", to: "I2C GND · 5V" },
      { colors: [BLUE, PURPLE], part: "OLED SDA · SCL", to: "I2C SDA · SCL" },
    ],
  };
}

function servoPart() {
  const s = servo(14, 384, [pin("an:io4:G"), pin("an:io4:V"), pin("an:io4:S")]);
  return {
    svg: [s.svg, name(48, 446, "서보 모터")].join("\n  "),
    used: ["an:io4:G", "an:io4:V", "an:io4:S"],
    rows: [{ colors: [BROWN, RED, ORANGE], part: "서보 플러그", to: "io4 줄 G·V·S" }],
  };
}

export default {
  "wiring-door.svg": () => {
    const u = ultrasonicPart(), o = oledPart(), s = servoPart();
    const table = connectionTable(462, "이렇게 꽂아요 — 브레드보드 없이 보드에 바로", [...u.rows, ...o.rows, ...s.rows]);
    const body = compose(board([...u.used, ...o.used, ...s.used]), [u.svg, o.svg, s.svg], [...u.wires, ...o.wires], [table.svg]);
    return svgDoc("wd", "자동문 배선도(브레드보드 없이 보드에 바로 연결): 초음파 센서 VCC 는 보드 위쪽 5V, GND 는 GND, Trig 는 io13, Echo 는 io12 에 F-F 듀폰선으로. OLED 화면 GND·VCC·SDA·SCL 은 보드 I2C 묶음의 GND·5V·SDA·SCL 에 F-F 듀폰선으로. 서보 모터 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로 꽂기", body, table.bottom);
  },
  "wiring-ultrasonic.svg": () => {
    const u = ultrasonicPart();
    const table = connectionTable(462, "이렇게 꽂아요 — F-F 듀폰선 4가닥", u.rows);
    const body = compose(board(u.used), [u.svg], u.wires, [table.svg]);
    return svgDoc("wu", "초음파 센서 배선도(브레드보드 없이 보드에 바로 연결): VCC 는 보드 위쪽 5V, GND 는 GND, Trig 는 io13, Echo 는 io12 에 F-F 듀폰선 네 가닥으로", body, table.bottom);
  },
};
