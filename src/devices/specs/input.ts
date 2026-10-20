import type { DeviceSpec } from "../types";
import { I2C_ADDR, pinNo, RE_PIN, validPins } from "./common";

/**
 * 보드 라이브러리 public/lib/blocklab_rfid.py 가 주는 함수 이름. 생성 코드는 `from blocklab_rfid import *` 로 가져와
 * card_present(rc522)·card_uid(rc522) 처럼 읽개를 넘겨 부른다 (함수 몸통은 그 파일에, 이름 확인은 input.test.ts).
 */
export const RFID_LIB_NAMES = ["card_present", "card_uid"];

/**
 * RFID (dev_rfid_setup). Keyestudio mfrc522_i2c 라이브러리. 이름 rc522 고정. 카드 읽기 함수 card_present(reader)·card_uid(reader) 는
 * 보드 라이브러리 blocklab_rfid 에 있다.
 */
export const rfid: DeviceSpec = {
  id: "rfid", category: "input", label: "RFID", toolboxOrder: 80, colour: "#8b6b3e",
  setup: {
    blockType: "dev_rfid_setup", message: "RFID 준비하기 (scl 핀 %1, sda 핀 %2, 주소 %3)",
    parts: [pinNo("SCL", 22, "bus"), pinNo("SDA", 21, "bus"), { kind: "text", name: "ADDR", default: "0x28", validate: I2C_ADDR }],
    tooltip: "rc522 = mfrc522(22, 21, 0x28) — RFID 읽개 rc522 를 준비합니다. 카드 읽기 함수는 보드 라이브러리(blocklab_rfid)에서 가져와요.",
    lines: (v) => [`rc522 = mfrc522(${v.SCL}, ${v.SDA}, ${v.ADDR})`, "rc522.PCD_Init()"],
    kind: "rfid",
    provides: () => ["rc522"],
    pattern: {
      lines: [/^rc522\s*=\s*mfrc522\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(0x[0-9a-fA-F]+)\s*\)$/, /^rc522\.PCD_Init\(\s*\)$/],
      fields: ([m]) => (validPins(m[1], m[2]) ? { SCL: m[1], SDA: m[2], ADDR: m[3] } : null),
    },
    libFiles: ["mfrc522_i2c.py", "mfrc522_config.py", "soft_iic.py", "blocklab_rfid.py"],
    libNames: RFID_LIB_NAMES,
  },
  actions: [],
  values: [
    {
      blockType: "dev_rfid_present", message: "카드가 있는가", parts: [],
      tooltip: "card_present(rc522) — 새 카드를 대고 번호까지 읽었으면 참",
      code: () => "card_present(rc522)",
      output: "Boolean",
      pattern: { kind: "call", name: "card_present", args: [["rc522"]] },
    },
    {
      blockType: "dev_rfid_uid", message: "카드 번호", parts: [],
      tooltip: "card_uid(rc522) — 마지막으로 읽은 카드 번호 (바이트 목록)",
      code: () => "card_uid(rc522)",
      output: null,
      pattern: { kind: "call", name: "card_uid", args: [["rc522"]] },
    },
  ],
};

/** 키패드 핀 칸 이름 (행 4개, 열 4개 — KeyPad 생성자 인자 순서) */
const KEYPAD_PINS = ["R1", "R2", "R3", "R4", "C1", "C2", "C3", "C4"];

/** 4×4 키패드 (dev_keypad_setup). Keyestudio keypad 라이브러리. 이름 keypad 고정 */
export const keypad: DeviceSpec = {
  id: "keypad", category: "input", label: "키패드", toolboxOrder: 81, colour: "#67622d",
  setup: {
    blockType: "dev_keypad_setup", message: "4×4 키패드 준비하기 (행 핀 %1 %2 %3 %4, 열 핀 %5 %6 %7 %8)",
    // 라이브러리가 행 핀을 출력으로, 열 핀을 풀다운 입력으로 쓴다
    parts: [
      pinNo("R1", 26, "out"), pinNo("R2", 25, "out"), pinNo("R3", 17, "out"), pinNo("R4", 16, "out"),
      pinNo("C1", 27, "in"), pinNo("C2", 14, "in"), pinNo("C3", 12, "in"), pinNo("C4", 13, "in"),
    ],
    tooltip: "keypad = KeyPad(행 핀 4개, 열 핀 4개)",
    lines: (v) => [`keypad = KeyPad(${KEYPAD_PINS.map((p) => v[p]).join(", ")})`],
    kind: "keypad",
    provides: () => ["keypad"],
    pattern: {
      lines: [new RegExp(String.raw`^keypad\s*=\s*KeyPad\(\s*${Array(8).fill(RE_PIN).join(String.raw`\s*,\s*`)}\s*\)$`)],
      fields: ([m]) => {
        const pins = m.slice(1, 9);
        return validPins(...pins) ? Object.fromEntries(KEYPAD_PINS.map((p, i) => [p, pins[i]])) : null;
      },
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
  id: "ir", category: "input", label: "IR 리모컨", toolboxOrder: 82, colour: "#a9755e",
  setup: {
    blockType: "dev_ir_setup", message: "IR 수신기를 핀 %1 에 준비하기",
    parts: [pinNo("PIN", 5, "in")],
    tooltip: "ir = irGetCMD(5) — 리모컨 신호를 받습니다.",
    lines: (v) => [`ir = irGetCMD(${v.PIN})`],
    kind: "ir",
    provides: () => ["ir"],
    pattern: {
      lines: [/^ir\s*=\s*irGetCMD\(\s*(\d+)\s*\)$/],
      fields: ([m]) => (validPins(m[1]) ? { PIN: m[1] } : null),
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
