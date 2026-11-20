# 배선도 그리기 도구 (scripts/wiring)

챕터 배선도를 **세 보드**로 만든다. 학생은 챕터 화면 위의 보드 선택으로 하나를 본다.

| 보드 | 파일 | 연결 방식 |
|---|---|---|
| ESP32 Plus 확장 보드 (Keyestudio KS5020, 기본) | `images/<이름>.svg` | 모듈은 F-F 듀폰선(서보는 플러그)으로 보드 핀 묶음에 **바로**. 맨 부품(LED·저항·버튼·부저·가변저항·포토레지스터·틸트 스위치)만 브레드보드 |
| 기본 보드 ESP32 DevKit 38핀 | `images/<이름>.devkit.svg` | 모듈 신호선은 F-F 로 바로. 전원을 여러 부품이 나눠 쓰면 브레드보드 + − 줄. 맨 부품은 브레드보드 |
| 확장 보드 (38핀 확장 보드 + DevKit 38핀) | `images/<이름>.expansion.svg` | 3핀 모듈은 F-F 로 그 GPIO 칸의 S · V · G 에 **바로**, 서보는 플러그째 기둥에, I2C 모듈은 I2C 헤더(GND VCC D21 D22). 맨 부품은 브레드보드 + M-F(칸의 S 핀 · GND 칸 S 핀) |

```bash
node scripts/wiring/build.mjs 10-auto-door
```
`chapters/<id>.mjs` 의 명세(`{ "wiring-x.svg": { plus, devkit, expansion } }`)를 읽어 `content/chapters/<id>/images/` 에 판마다 그림과 3D 장면(`.3d.json`)을 쓴다. 확인용으로 다른 폴더에 쓰려면 두 번째 인자로 폴더를 준다.

## 파일
- `common.mjs` — `svgDoc`, `compose`(겹 순서: 보드 판·핀 → 부품 → 선 → 보드 글자 → 노란 테두리 → 표), 선 `ffWire`(F-F) · `mfWire`(보드 핀 f → 브레드보드 구멍 m) · `mmWire`(구멍↔구멍) · `wire(from, to, color, { via, style, ends })`, `connectionTable`(아래 연결 표, 글이 길면 한 칸), `name`·`note`, 색 `COLORS`.
  - 선 모양 `style`: `"vv"`(세로로 나가 세로로 들어감, 기본) · `"hv"` · `"vh"` · `"orth"`(via 점들을 직각으로 — 길게 돌아가는 선에) · `"line"`.
- `boards/plus.mjs` — `makePlus({ x, y })` (크기 428×300). `boards/devkit.mjs` — `makeDevkit({ x, y })` (크기 470×150, USB 왼쪽).
- `boards/expansion.mjs` — `makeExpansion({ x, y, jumper })` (보드 612×314 + 아래 메모 한 줄, x 는 22 쯤). DevKit 그림(`devkit.mjs`)을 0.9 배로 줄여 노란 암 헤더 위에 얹는다(새로 그리지 않음).
  핀 이름 `"top:P13:S"` · `"bot:P4:G"` · `"pwr:GND:0..3"` · `"pwr:3V:0..1"` · `"pwr:5V:0..1"` · `"i2c:GND|VCC|SDA|SCL"` · `"uart:…"` · `"jump:5V|V|3V3"`.
  `b.gpio(n)` = 그 칸의 S 핀(라벨 `P13` · `SVP(36)` …, `{ at: "i2c" }` 면 21 · 22 를 I2C 헤더로), `b.triple(n)` = 세로 기둥 `{ S, V, G, side }`,
  `b.power("5V"|"3V3"|"GND", k)`, `b.i2c(0)` = I2C 헤더, `b.uart()`. 서보는 같은 파일의 `columnServo(b.triple(n), { gap })`. 자세한 표는 파일 머리말.
  - **JUMP 점퍼** `jumper: "3V3"`(기본, 평소 자리) 또는 `"5V"`. V 줄과 I2C 헤더 VCC 가 그 전압이 된다. 서보 · 초음파처럼 5V 가 필요한 수업만 `"5V"`,
    그리고 **한 챕터의 확장 보드 그림은 모두 같은 점퍼**로(콘텐츠 검사). 그림 기판에 `data-expansion-jumper` 가 남아 화면이 "점퍼를 5V 쪽으로" 안내를 저절로 띄운다.
  - 본보기: `chapters/01-led.mjs`(맨 부품, 3.3V) · `chapters/10-auto-door.mjs`(초음파 · OLED · 서보, 5V). 확인용: `node scripts/wiring/preview-expansion.mjs [폴더]`.
- `parts.mjs` — 모듈과 맨 부품, 브레드보드.

## 보드 공통 함수 (두 보드가 같은 이름)
| 함수 | 뜻 |
|---|---|
| `b.gpio(n)` | GPIO n 의 신호 핀 좌표 `{ x, y, name, label }`. Plus: 위 한 줄(18 19 23 5 13 12 14 27 16 17 25 26) · ANALOG 묶음 S(35 34 33 32 4 2) · 아래 줄(36 39 0) · 21=SDA · 22=SCL. **Plus 에는 io15 가 없다(오류)**. DevKit: D13·VP(36)·VN(39)·RX2(16)·TX2(17) … |
| `b.power("5V" \| "3V3" \| "GND", k)` | 전원 핀. Plus 5V: k=0 위 줄, 1·2 아래 줄 / GND: k=0 위, 1 아래. DevKit 5V 는 VIN(하나뿐), GND: k=0 위 줄, 1 아래 줄 |
| `b.triple(n)` | Plus 만: 3핀 모듈·서보 플러그를 꽂을 S·V·G 세 핀 (위 디지털 기둥 또는 ANALOG 행). DevKit 은 `null` |
| `b.i2c(row)` | Plus: I2C 묶음 한 줄 `{ GND, VCC(5V), SDA, SCL }` (모듈 셋까지). DevKit: GND·VIN·D21·D22 |
| `b.draw(used)` | `used` 에 넣은 핀만 또렷하게 + 노란 테두리, 나머지 흐리게 |
| `b.bounds` · `b.legend` · `b.lane`(Plus: 위 G 줄과 ESP32 모듈 사이 가로 빈 띠) | |

## 부품 (parts.mjs) — 모두 `{ svg, pins }`
- 모듈: `ultrasonic(x, y)`(VCC Trig Echo GND) · `oled(x, y, { side })`(GND VCC SCL SDA, 기본 위쪽) · `rfid`(GND VCC SDA SCL) · `sensor3(x, y, "dht" | "pir" | "sound" | "flame" | "ir" | "lm35" | "soil" | "water")`(G V S — soil 토양 수분 · water 수위는 76×110 긴 판, 핀 반대쪽에 탐침 · 줄무늬) · `relay(x, y, { side, pins, terminals })`(입력 G V S, 반대쪽 나사 단자 COM NO — 모두 pins 로 기록, kind "relay") · `joystick`(X Y B V G) · `keypad`(R1~R4 C1~C4) · `fan`(G V IN+ IN−) · 일반 `module({...})`.
- 서보: Plus 는 `servo(x, y, [G, V, S])` (플러그를 보드 세 핀에 그대로). DevKit 은 `servoWithPlug(x, y, { plugSide, order })` + 플러그 구멍에 M-F/M-M 선.
- 브레드보드: `breadboard({ x, y, cols, rails: { top, bottom }, railsOnly })` → `hole(col, "a"~"j")`, `rail(side, "+"|"-", col)`(6·12·18… 열은 구멍 없음), `nearestCol(x, railHole)`, `tint(col, "top"|"bottom")`(이어진 다섯 칸 옅게). `railsOnly` 는 + − 두 줄 띠.
- 맨 부품(구멍 좌표를 받음): `led(anode, cathode, color)` · `resistor(a, b, { label })` · `button(bb, col)`(홈을 건너 다리 4개) · `buzzer(plus, minus, { active })` · `potentiometer(l, m, r)` · `photoresistor(a, b)` · `tiltSwitch(a, b)` · `rgbLed([R, −, G, B])` · `rgbSpread([R, −, G, B])`(다리를 벌려 꽂은 RGB) · `irReceiver([OUT, G, V])` · `dip(bb, col, n, { label })`(74HC595 등, `pin(k)`).
- 소품: `powerJack({ x, y, w, h })`(Plus 외부 전원 단자) · `batteryHolder(x, y)`(AA 6개, `{ svg, plus, minus }`) · `waterPump(x, y, { w, h, hose })`(물통과 미니 워터 펌프, 3D 는 prop kind "pump". `{ svg, plus, minus, hose }` — plus · minus 는 물통 사각형 안 위쪽 선 끝이라 릴레이 NO · GND 선을 여기에 잇는다).
- 3D 기록: 부품 함수는 `rec("parts", …)` 로 남기고 SVG 를 `mark()` 로 감싼다. 챕터가 손으로 그린 조각이 mark 되지 않으면 그 그림은 `.3d.json` 을 내지 않는다(`WIRING_DEBUG=1` 로 찍힘). 그룹을 `translate+scale` 로 옮겨 그리면 `recCount()` · `moveSince(since, tx, ty, s)` 로 기록도 같이 옮긴다(6장).

## 배치 요령 (본보기: chapters/10-auto-door.mjs, chapters/01-led.mjs)
- 폭 640, 높이는 표 끝(`table.bottom`)까지. 오른쪽 위(x>560, y<44)는 "크게 보기" 자리라 비운다.
- 브레드보드가 있으면 **보드 위**에 두어 핀에서 선이 위로 짧게 올라가게 하고, 회로는 그 핀 바로 위 열에 둔다(보드마다 열 번호가 달라도 된다 — 글은 `captionDevkit` 으로 따로).
- Plus 모듈은 위쪽 띠(보드 위)·오른쪽(OLED 등)·왼쪽(서보)에. 긴 선은 `orth` 로 보드 바깥 길이나 `b.lane` 을 지나게.
- 선 색: 5V·VCC 빨강, GND 검정, 신호는 노랑·초록·파랑·보라·주황. 연결 표의 색과 같게.
- 확인: `node scripts/wiring/build.mjs <id> <임시 폴더>` 뒤 PNG 로 그려 눈으로 본다(밝은·어두운 화면). 글자가 겹치거나 선이 다른 핀 위를 지나 꽂힌 것처럼 보이면 고친다.
