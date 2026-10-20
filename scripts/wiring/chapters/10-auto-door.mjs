// 융합 F3 "다가가면 열리는 자동문" — 모듈 셋을 브레드보드 없이 F-F 듀폰선·서보 플러그로 보드에 바로 꽂는다.
import { board, compose, ffWire, note, oled, pin, servo, svgDoc, ultrasonic } from "../esp32plus.mjs";

const RED = "#e03131", BLACK = "#343a40", YELLOW = "#f59f00", GREEN = "#2f9e44", BLUE = "#1971c2", PURPLE = "#7048e8";

function ultrasonicPart() {
  const u = ultrasonic(214, 12);
  const wires = [
    ffWire(u.pins.VCC, pin("top:5V"), RED),
    ffWire(u.pins.GND, pin("top:GND"), BLACK),
    ffWire(u.pins.Trig, pin("top:io13"), YELLOW),
    ffWire(u.pins.Echo, pin("top:io12"), GREEN),
  ];
  return { svg: u.svg, wires, hl: ["top:5V", "top:GND", "top:io13", "top:io12"] };
}

function oledPart() {
  const o = oled(510, 230);
  // 화면 위쪽 핀에서 위로 빠져 ESP32 모듈 위 빈 띠(가로 길)를 지나 I2C 핀에 위에서 꽂힌다
  const route = (from, to, lane) => [{ x: from.x, y: lane }, { x: to.x, y: lane }];
  const t = { GND: pin("i2c:GND:0"), VCC: pin("i2c:5V:0"), SCL: pin("i2c:SCL:0"), SDA: pin("i2c:SDA:0") };
  const lanes = { GND: 204, VCC: 208, SDA: 212, SCL: 216 };
  const wires = [
    ffWire(o.pins.GND, t.GND, BLACK, route(o.pins.GND, t.GND, lanes.GND), "orth"),
    ffWire(o.pins.VCC, t.VCC, RED, route(o.pins.VCC, t.VCC, lanes.VCC), "orth"),
    ffWire(o.pins.SCL, t.SCL, PURPLE, route(o.pins.SCL, t.SCL, lanes.SCL), "orth"),
    ffWire(o.pins.SDA, t.SDA, BLUE, route(o.pins.SDA, t.SDA, lanes.SDA), "orth"),
  ];
  return { svg: o.svg, wires, hl: ["i2c:GND:0", "i2c:5V:0", "i2c:SDA:0", "i2c:SCL:0"] };
}

function servoPart() {
  const s = servo(14, 238, [pin("an:io4:G"), pin("an:io4:V"), pin("an:io4:S")]);
  return { svg: s.svg, wires: [], hl: [] };
}

export default {
  "wiring-door.svg": () => {
    const u = ultrasonicPart(), o = oledPart(), s = servoPart();
    const body = compose(board([...u.hl, ...o.hl]), [u.svg, o.svg, s.svg], [...u.wires, ...o.wires], [
      note(14, 214, "플러그를 io4 줄에 그대로"),
      note(14, 232, "갈색 G · 빨강 V · 주황 S"),
    ]);
    return svgDoc("wd", "자동문 배선도(브레드보드 없이 보드에 바로 연결): 초음파 센서 VCC 는 보드 위쪽 5V, GND 는 GND, Trig 는 io13, Echo 는 io12 에 F-F 듀폰선으로. OLED 화면 GND·VCC·SCL·SDA 는 보드 I2C 묶음의 GND·5V·SCL·SDA 에 F-F 듀폰선으로. 서보 모터 플러그는 ANALOG 묶음 io4 줄에 갈색 G, 빨강 V, 주황 S 가 맞도록 그대로 꽂기", body);
  },
  "wiring-ultrasonic.svg": () => {
    const u = ultrasonicPart();
    const body = compose(board(u.hl), [u.svg], u.wires);
    return svgDoc("wu", "초음파 센서 배선도(브레드보드 없이 보드에 바로 연결): VCC 는 보드 위쪽 5V, GND 는 GND, Trig 는 io13, Echo 는 io12 에 F-F 듀폰선 네 가닥으로", body);
  },
};
