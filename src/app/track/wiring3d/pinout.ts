/*
 * 핀 배치도 데이터 (한글). ESP32 데이터시트(ESP32 Series Datasheet)의 핀 기능을 우리 말로 옮긴 것.
 * 그림은 우리가 직접 그린다 (PinoutDialog.tsx).
 */

export type PinKind = "safe" | "care" | "input" | "flash" | "serial" | "power" | "gnd" | "en";

export const KIND: Record<PinKind, { name: string; fill: string; ink: string; help: string }> = {
  safe: { name: "마음껏 쓰는 핀", fill: "#d3f9d8", ink: "#2b8a3e", help: "LED · 버튼 · 센서 어디에나 써도 되는 핀이에요." },
  care: { name: "조심해서 쓰는 핀", fill: "#ffe8cc", ink: "#d9480f", help: "보드가 켜질 때 쓰는 핀(부팅 핀)이에요. 켜는 순간 버튼을 누르고 있거나 잘못 이으면 프로그램이 시작되지 않을 수 있어요." },
  input: { name: "읽기만 하는 핀", fill: "#d0ebff", ink: "#1864ab", help: "센서 값을 읽을 수만 있어요. LED 처럼 켜는 데는 쓸 수 없어요." },
  flash: { name: "쓰지 않는 핀", fill: "#e9ecef", ink: "#868e96", help: "보드 안의 저장 칩(플래시)과 이어져 있어요. 건드리면 보드가 멈춰요." },
  serial: { name: "컴퓨터와 대화하는 핀", fill: "#e5dbff", ink: "#6741d9", help: "USB 로 코드를 올리고 print() 글자를 보낼 때 쓰는 핀이에요. 다른 부품을 꽂지 않아요." },
  power: { name: "전원", fill: "#ffe3e3", ink: "#c92a2a", help: "부품에 전기를 주는 핀이에요." },
  gnd: { name: "접지 (GND)", fill: "#343a40", ink: "#ffffff", help: "전기가 한 바퀴 돌아 보드로 돌아오는 곳이에요. 모든 부품의 − 쪽을 여기에 이어요." },
  en: { name: "다시 시작 (EN)", fill: "#495057", ink: "#ffffff", help: "이 핀을 GND 에 잠깐 이으면 보드가 처음부터 다시 시작해요 (EN 버튼과 같아요)." },
};

export type PinInfo = { label: string; gpio: number | null; kind: PinKind; tags: string[]; note?: string };

/** GPIO 번호마다 기능 꼬리표 (짧은 우리말) */
const G: Record<number, { kind: PinKind; tags: string[]; note?: string }> = {
  0: { kind: "care", tags: ["BOOT 버튼", "아날로그 읽기(ADC2)", "터치"], note: "보드의 BOOT 버튼과 이어져 있어요." },
  1: { kind: "serial", tags: ["USB 시리얼 보내기(TX)"] },
  2: { kind: "care", tags: ["내장 LED", "아날로그 읽기(ADC2)", "터치"], note: "보드에 붙은 작은 LED 와 이어져 있어요." },
  3: { kind: "serial", tags: ["USB 시리얼 받기(RX)"] },
  4: { kind: "safe", tags: ["아날로그 읽기(ADC2)", "터치"] },
  5: { kind: "care", tags: ["SPI CS"] },
  6: { kind: "flash", tags: ["플래시 CLK"] }, 7: { kind: "flash", tags: ["플래시 D0"] }, 8: { kind: "flash", tags: ["플래시 D1"] },
  9: { kind: "flash", tags: ["플래시 D2"] }, 10: { kind: "flash", tags: ["플래시 D3"] }, 11: { kind: "flash", tags: ["플래시 CMD"] },
  12: { kind: "care", tags: ["아날로그 읽기(ADC2)", "터치"], note: "켜질 때 HIGH 이면 보드가 시작되지 않아요." },
  13: { kind: "safe", tags: ["아날로그 읽기(ADC2)", "터치"] },
  14: { kind: "safe", tags: ["아날로그 읽기(ADC2)", "터치"] },
  15: { kind: "care", tags: ["아날로그 읽기(ADC2)", "터치"] },
  16: { kind: "safe", tags: ["UART2 받기(RX2)"] },
  17: { kind: "safe", tags: ["UART2 보내기(TX2)"] },
  18: { kind: "safe", tags: ["SPI SCK"] },
  19: { kind: "safe", tags: ["SPI MISO"] },
  21: { kind: "safe", tags: ["I2C SDA"], note: "OLED · 센서 같은 I2C 부품의 SDA 를 이어요." },
  22: { kind: "safe", tags: ["I2C SCL"], note: "OLED · 센서 같은 I2C 부품의 SCL 을 이어요." },
  23: { kind: "safe", tags: ["SPI MOSI"] },
  25: { kind: "safe", tags: ["아날로그 내보내기(DAC1)", "아날로그 읽기(ADC2)"] },
  26: { kind: "safe", tags: ["아날로그 내보내기(DAC2)", "아날로그 읽기(ADC2)"] },
  27: { kind: "safe", tags: ["아날로그 읽기(ADC2)", "터치"] },
  32: { kind: "safe", tags: ["아날로그 읽기(ADC1)", "터치"] },
  33: { kind: "safe", tags: ["아날로그 읽기(ADC1)", "터치"] },
  34: { kind: "input", tags: ["아날로그 읽기(ADC1)", "입력만"] },
  35: { kind: "input", tags: ["아날로그 읽기(ADC1)", "입력만"] },
  36: { kind: "input", tags: ["아날로그 읽기(ADC1)", "입력만"] },
  39: { kind: "input", tags: ["아날로그 읽기(ADC1)", "입력만"] },
};

export const ADC2_NOTE = "ADC2 핀은 WiFi 를 켜면 아날로그 값을 읽을 수 없어요. WiFi 와 함께 쓸 때는 ADC1 핀(32~39)을 써요.";

/** 보드에 적힌 이름 → 핀 정보 */
export function pinInfo(label: string): PinInfo {
  const l = label.replace(/^io\s*/i, "").replace(/^[DP](?=\d)/, "").trim();
  const alias: Record<string, number> = { VP: 36, VN: 39, SVP: 36, SVN: 39, TX: 1, TX0: 1, RX: 3, RX0: 3, RX2: 16, TX2: 17, CLK: 6, D0: 7, D1: 8, D2: 9, D3: 10, SD0: 7, SD1: 8, SD2: 9, SD3: 10, CMD: 11, SCL: 22, SDA: 21 };
  if (/^(5V|VIN)$/.test(l)) return { label, gpio: null, kind: "power", tags: ["5V"], note: "USB 로 켜면 5V 가 나와요. 모터 · 초음파 센서처럼 힘이 필요한 부품에 써요." };
  if (/^(3V3|3\.3V)$/.test(l)) return { label, gpio: null, kind: "power", tags: ["3.3V"], note: "센서 대부분은 3.3V 로 충분해요." };
  if (/^GND$/.test(l)) return { label, gpio: null, kind: "gnd", tags: ["0V"] };
  if (/^(EN|RST)$/.test(l)) return { label, gpio: null, kind: "en", tags: ["리셋"] };
  const n = alias[l] ?? (/^\d+$/.test(l) ? Number(l) : NaN);
  const g = G[n];
  if (!g) return { label, gpio: null, kind: "flash", tags: [] };
  return { label, gpio: n, kind: g.kind, tags: g.tags, note: g.note };
}
