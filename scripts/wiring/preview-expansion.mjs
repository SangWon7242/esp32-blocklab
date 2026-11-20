// 확장 보드(boards/expansion.mjs) 확인용 그림 — 콘텐츠 폴더는 건드리지 않는다.
// 사용: node scripts/wiring/preview-expansion.mjs [출력 폴더]   (기본 .superpowers/sdd/expansion-board)
//   expansion-board.svg            보드만 (DevKit 을 꽂은 모습, 모든 핀 이름)
//   wiring-door.expansion.svg      10장 자동문 본보기 (초음파 + Echo 전압 나누기 + OLED + 서보, 점퍼 5V) — chapters/10-auto-door.mjs 의 expansion 판
//   wiring-led.expansion.svg       1장 LED 본보기 (맨 부품 + 브레드보드, 점퍼 3.3V) — chapters/01-led.mjs 의 expansion 판
//   + 각 .3d.json (build.mjs 와 같은 꼴, board: "expansion")
// 챕터 명세(chapters/<id>.mjs)의 expansion: () => svg 판은 build.mjs 가 <이름>.expansion.svg 로 쓴다.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { name, svgDoc } from "./common.mjs";
import { makeExpansion } from "./boards/expansion.mjs";
import doorSpec from "./chapters/10-auto-door.mjs";
import ledSpec from "./chapters/01-led.mjs";
import { endScene, startScene } from "./record.mjs";

const out = process.argv[2] ?? join(import.meta.dirname, "../../.superpowers/sdd/expansion-board");
mkdirSync(out, { recursive: true });

/** 보드만 */
function boardOnly() {
  const b = makeExpansion({ x: 22, y: 52 });
  const d = b.draw([]);
  const body = [name(22, 20, "확장 보드 (ESP32 38핀 확장 보드 + 기본 보드 DevKit 38핀)", "start", 15), d.base, d.labels, d.marks].join("\n  ");
  return svgDoc("xb", "ESP32 38핀 확장 보드에 기본 보드 DevKit 38핀을 꽂은 모습: 가운데 노란 암 헤더에 DevKit, 그 바깥에 GPIO 마다 S(노랑) V(빨강) G(검정) 3핀. 위 줄 5V CMD SD3 SD2 P13 GND P12 P14 P27 P26 P25 P33 P32 P35 P34 SVN SVP EN, 아래 줄 CLK SD0 SD1 P15 P2 P0 P4 P16 P17 P5 P18 P19 GND P21 RX TX P22 P23. 왼쪽 전원부: USB-C(USB5V), 전원 헤더(GND, 3V, 5V), JUMP(V 줄 전압 5V 또는 3.3V), 마이크로 USB, DC 잭(DC6.5-16V), I2C 헤더(GND VCC D21 D22)와 UART 헤더(GND VCC RX TX)", body, b.bounds.y + b.bounds.h + 8);
}

// 본보기 두 그림은 챕터 명세(chapters/10-auto-door.mjs · 01-led.mjs)의 expansion 판을 그대로 쓴다
const door = doorSpec["wiring-door.svg"].expansion;
const led = ledSpec["wiring-led.svg"].expansion;

for (const [file, fn] of [["expansion-board.svg", boardOnly], ["wiring-door.expansion.svg", door], ["wiring-led.expansion.svg", led]]) {
  startScene();
  const svg = fn();
  const scene = endScene();
  writeFileSync(join(out, file), svg);
  console.log("wrote", join(out, file));
  const out3d = join(out, file.replace(/\.svg$/, ".3d.json"));
  const { composed, unsupported, ...data } = scene;
  if (!(composed && !unsupported && /^wiring-/.test(file))) rmSync(out3d, { force: true });
  else {
    const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)?.[1] ?? 0);
    writeFileSync(out3d, JSON.stringify({ board: "expansion", height, ...data }) + "\n");
    console.log("wrote", out3d);
  }
}
