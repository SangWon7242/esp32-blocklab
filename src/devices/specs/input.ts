import type { DeviceSpec } from "../types";
import { pinNo, RE_PIN, validPins } from "./common";

/** RFID (dev_rfid_setup). Keyestudio mfrc522_i2c 라이브러리. 이름 rc522 고정, card_present()·card_uid() 도우미 */
export const rfid: DeviceSpec = {
  id: "rfid", category: "input", label: "RFID", toolboxOrder: 80,
  setup: {
    blockType: "dev_rfid_setup", message: "RFID 준비하기 (scl 핀 %1, sda 핀 %2, 주소 %3)",
    parts: [pinNo("SCL", 22), pinNo("SDA", 21), { kind: "text", name: "ADDR", default: "0x28" }],
    tooltip: "rc522 = mfrc522(22, 21, 0x28) 과 카드를 읽는 card_present()·card_uid() 함수를 준비합니다.",
    lines: (v) => [`rc522 = mfrc522(${v.SCL}, ${v.SDA}, ${v.ADDR})`, "rc522.PCD_Init()"],
    helpers: [
      { name: "card_present", params: "", body: ["return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()"] },
      { name: "card_uid", params: "", body: ["return rc522.uid.uidByte[0:rc522.uid.size]"] },
    ],
    kind: "rfid",
    pattern: {
      lines: [/^rc522\s*=\s*mfrc522\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(0x[0-9a-fA-F]+)\s*\)$/, /^rc522\.PCD_Init\(\s*\)$/],
      fields: ([m]) => (validPins(m[1], m[2]) ? { SCL: m[1], SDA: m[2], ADDR: m[3] } : null),
      vars: () => ["rc522"],
    },
    libFiles: ["mfrc522_i2c.py", "mfrc522_config.py", "soft_iic.py"],
  },
  actions: [],
  values: [
    {
      blockType: "dev_rfid_present", message: "카드가 있는가", parts: [],
      tooltip: "card_present() — 새 카드를 대고 번호까지 읽었으면 참",
      code: () => "card_present()",
      output: "Boolean",
      pattern: { kind: "call", name: "card_present", args: [] },
    },
    {
      blockType: "dev_rfid_uid", message: "카드 번호", parts: [],
      tooltip: "card_uid() — 마지막으로 읽은 카드 번호 (바이트 목록)",
      code: () => "card_uid()",
      output: null,
      pattern: { kind: "call", name: "card_uid", args: [] },
    },
  ],
};

/** 키패드 핀 칸 이름 (행 4개, 열 4개 — KeyPad 생성자 인자 순서) */
const KEYPAD_PINS = ["R1", "R2", "R3", "R4", "C1", "C2", "C3", "C4"];

/** 4×4 키패드 (dev_keypad_setup). Keyestudio keypad 라이브러리. 이름 keypad 고정 */
export const keypad: DeviceSpec = {
  id: "keypad", category: "input", label: "키패드", toolboxOrder: 81,
  setup: {
    blockType: "dev_keypad_setup", message: "4×4 키패드 준비하기 (행 핀 %1 %2 %3 %4, 열 핀 %5 %6 %7 %8)",
    parts: [pinNo("R1", 26), pinNo("R2", 25), pinNo("R3", 17), pinNo("R4", 16), pinNo("C1", 27), pinNo("C2", 14), pinNo("C3", 12), pinNo("C4", 13)],
    tooltip: "keypad = KeyPad(행 핀 4개, 열 핀 4개)",
    lines: (v) => [`keypad = KeyPad(${KEYPAD_PINS.map((p) => v[p]).join(", ")})`],
    kind: "keypad",
    pattern: {
      lines: [new RegExp(String.raw`^keypad\s*=\s*KeyPad\(\s*${Array(8).fill(RE_PIN).join(String.raw`\s*,\s*`)}\s*\)$`)],
      fields: ([m]) => {
        const pins = m.slice(1, 9);
        return validPins(...pins) ? Object.fromEntries(KEYPAD_PINS.map((p, i) => [p, pins[i]])) : null;
      },
      vars: () => ["keypad"],
    },
    libFiles: ["keypad.py"],
  },
  actions: [],
  values: [
    {
      blockType: "dev_keypad_key", message: "눌린 키", parts: [],
      tooltip: "keypad.scan() — 눌린 키 값 (안 눌렸으면 None)",
      code: () => "keypad.scan()",
      output: null,
      pattern: { kind: "method", name: "scan", args: [], objName: "keypad" },
    },
  ],
};

/** IR 리모컨 수신기 (dev_ir_setup). Keyestudio irrecvdata 라이브러리. 이름 ir 고정 */
export const ir: DeviceSpec = {
  id: "ir", category: "input", label: "IR 리모컨", toolboxOrder: 82,
  setup: {
    blockType: "dev_ir_setup", message: "IR 수신기를 핀 %1 에 준비하기",
    parts: [pinNo("PIN", 5)],
    tooltip: "ir = irGetCMD(5) — 리모컨 신호를 받습니다.",
    lines: (v) => [`ir = irGetCMD(${v.PIN})`],
    kind: "ir",
    pattern: {
      lines: [/^ir\s*=\s*irGetCMD\(\s*(\d+)\s*\)$/],
      fields: ([m]) => (validPins(m[1]) ? { PIN: m[1] } : null),
      vars: () => ["ir"],
    },
    libFiles: ["irrecvdata.py"],
  },
  actions: [],
  values: [
    {
      blockType: "dev_ir_value", message: "리모컨에서 받은 값", parts: [],
      tooltip: "ir.ir_read() — 받은 버튼 값 (없으면 None)",
      code: () => "ir.ir_read()",
      output: null,
      pattern: { kind: "method", name: "ir_read", args: [], objName: "ir" },
    },
  ],
};
