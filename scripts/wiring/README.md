# 배선도 그리기 도구 (scripts/wiring)

챕터 배선도를 **두 보드**로 만든다. 학생은 챕터 화면 위의 보드 선택으로 둘 중 하나를 본다.

| 보드 | 파일 | 연결 방식 |
|---|---|---|
| ESP32 Plus 확장 보드 (Keyestudio KS5020, 기본) | `images/<이름>.svg` | 모듈은 F-F 듀폰선(서보는 플러그)으로 보드 핀 묶음에 **바로**. 맨 부품(LED·저항·버튼·부저·가변저항·포토레지스터·틸트 스위치)만 브레드보드 |
| 기본 보드 ESP32 DevKit V1 30핀 | `images/<이름>.devkit.svg` | 모듈 신호선은 F-F 로 바로. 전원을 여러 부품이 나눠 쓰면 브레드보드 + − 줄. 맨 부품은 브레드보드 |

```bash
node scripts/wiring/build.mjs 10-auto-door
```
`chapters/<id>.mjs` 의 명세를 읽어 `content/chapters/<id>/images/` 에 두 파일을 쓴다. 확인용으로 다른 폴더에 쓰려면 두 번째 인자로 폴더를 준다.

## 파일
- `common.mjs` — `svgDoc`, `compose`(겹 순서: 보드 판·핀 → 부품 → 선 → 보드 글자 → 노란 테두리 → 표), 선 `ffWire`(F-F) · `mfWire`(보드 핀 f → 브레드보드 구멍 m) · `mmWire`(구멍↔구멍) · `wire(from, to, color, { via, style, ends })`, `connectionTable`(아래 연결 표, 글이 길면 한 칸), `name`·`note`, 색 `COLORS`.
  - 선 모양 `style`: `"vv"`(세로로 나가 세로로 들어감, 기본) · `"hv"` · `"vh"` · `"orth"`(via 점들을 직각으로 — 길게 돌아가는 선에) · `"line"`.
- `boards/plus.mjs` — `makePlus({ x, y })` (크기 428×300). `boards/devkit.mjs` — `makeDevkit({ x, y })` (크기 470×150, USB 왼쪽).
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
- 모듈: `ultrasonic(x, y)`(VCC Trig Echo GND) · `oled(x, y, { side })`(GND VCC SCL SDA, 기본 위쪽) · `rfid`(GND VCC SDA SCL) · `sensor3(x, y, "dht" | "pir" | "sound" | "flame" | "ir" | "lm35")`(G V S) · `joystick`(X Y B V G) · `keypad`(R1~R4 C1~C4) · `fan`(G V IN+ IN−) · 일반 `module({...})`.
- 서보: Plus 는 `servo(x, y, [G, V, S])` (플러그를 보드 세 핀에 그대로). DevKit 은 `servoWithPlug(x, y, { plugSide, order })` + 플러그 구멍에 M-F/M-M 선.
- 브레드보드: `breadboard({ x, y, cols, rails: { top, bottom }, railsOnly })` → `hole(col, "a"~"j")`, `rail(side, "+"|"-", col)`(6·12·18… 열은 구멍 없음), `nearestCol(x, railHole)`, `tint(col, "top"|"bottom")`(이어진 다섯 칸 옅게). `railsOnly` 는 + − 두 줄 띠.
- 맨 부품(구멍 좌표를 받음): `led(anode, cathode, color)` · `resistor(a, b, { label })` · `button(bb, col)`(홈을 건너 다리 4개) · `buzzer(plus, minus, { active })` · `potentiometer(l, m, r)` · `photoresistor(a, b)` · `tiltSwitch(a, b)` · `rgbLed([R, −, G, B])` · `irReceiver([OUT, G, V])` · `dip(bb, col, n, { label })`(74HC595 등, `pin(k)`).

## 배치 요령 (본보기: chapters/10-auto-door.mjs, chapters/01-led.mjs)
- 폭 640, 높이는 표 끝(`table.bottom`)까지. 오른쪽 위(x>560, y<44)는 "크게 보기" 자리라 비운다.
- 브레드보드가 있으면 **보드 위**에 두어 핀에서 선이 위로 짧게 올라가게 하고, 회로는 그 핀 바로 위 열에 둔다(보드마다 열 번호가 달라도 된다 — 글은 `captionDevkit` 으로 따로).
- Plus 모듈은 위쪽 띠(보드 위)·오른쪽(OLED 등)·왼쪽(서보)에. 긴 선은 `orth` 로 보드 바깥 길이나 `b.lane` 을 지나게.
- 선 색: 5V·VCC 빨강, GND 검정, 신호는 노랑·초록·파랑·보라·주황. 연결 표의 색과 같게.
- 확인: `node scripts/wiring/build.mjs <id> <임시 폴더>` 뒤 PNG 로 그려 눈으로 본다(밝은·어두운 화면). 글자가 겹치거나 선이 다른 핀 위를 지나 꽂힌 것처럼 보이면 고친다.
