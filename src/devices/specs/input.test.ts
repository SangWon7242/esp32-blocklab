import { describe, expect, it } from "vitest";
import { forever, fromCode, ifThen, print, toCode, type B } from "../testkit";

const val = (type: string): B => ({ type });

describe("RFID (dev_rfid_setup)", () => {
  const code = [
    "from mfrc522_i2c import mfrc522",
    "",
    "rc522 = mfrc522(22, 21, 0x28)",
    "rc522.PCD_Init()",
    "",
    "",
    "def card_present():",
    "    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()",
    "",
    "",
    "def card_uid():",
    "    return rc522.uid.uidByte[0:rc522.uid.size]",
    "",
    "",
    "while True:",
    "    if card_present():",
    "        print(card_uid())",
    "",
  ].join("\n");
  const blocks: B[] = [{ type: "dev_rfid_setup", fields: { SCL: 22, SDA: 21, ADDR: "0x28" } }, forever([ifThen(val("dev_rfid_present"), [print(val("dev_rfid_uid"))])])];

  it("준비 2줄, card_present·card_uid 도우미 (from mfrc522_i2c import mfrc522)", () => {
    expect(toCode(blocks)).toBe(code);
  });
  it("왕복: 도우미까지 접혀 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["start_program"]);
    expect(r.types).toEqual(["dev_rfid_setup", "flow_repeat_forever", "controls_if", "esp_print", "dev_rfid_uid", "dev_rfid_present"]);
    expect(r.body[0].fields).toEqual({ SCL: 22, SDA: 21, ADDR: "0x28" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("도우미가 표준 꼴이 아니면 접지 않고 card_present() 도 장치 블록이 아니다", () => {
    const r = fromCode(code.replace("[0:rc522.uid.size]", "[0:4]"));
    expect(r.types).not.toContain("dev_rfid_setup");
    expect(r.types).not.toContain("dev_rfid_present");
    expect(r.tops).toContain("procedures_defreturn");
  });
});

describe("4×4 키패드 (dev_keypad_setup)", () => {
  const code = "from keypad import KeyPad\n\nkeypad = KeyPad(26, 25, 17, 16, 27, 14, 12, 13)\n\nprint(keypad.scan())\n";
  const pins = { R1: 26, R2: 25, R3: 17, R4: 16, C1: 27, C2: 14, C3: 12, C4: 13 };

  it("행 핀 4개·열 핀 4개 준비, 눌린 키", () => {
    expect(toCode([{ type: "dev_keypad_setup", fields: pins }, print(val("dev_keypad_key"))])).toBe(code);
  });
  it("왕복: 같은 블록들, 핀 8개, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_keypad_setup", "esp_print", "dev_keypad_key"]);
    expect(r.body[0].fields).toEqual(pins);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("핀 번호가 39 보다 크면 준비 블록으로 접지 않는다", () => {
    expect(fromCode(code.replace("KeyPad(26,", "KeyPad(40,")).types).not.toContain("dev_keypad_setup");
  });
  it("준비되지 않은 이름의 scan() 은 장치 블록이 아니다", () => {
    expect(fromCode("print(pad.scan())\n").types).not.toContain("dev_keypad_key");
  });
});

describe("IR 리모컨 (dev_ir_setup)", () => {
  const code = "from irrecvdata import irGetCMD\n\nir = irGetCMD(5)\n\nwhile True:\n    print(ir.ir_read())\n";

  it("준비 1줄, 받은 값", () => {
    expect(toCode([{ type: "dev_ir_setup", fields: { PIN: 5 } }, forever([print(val("dev_ir_value"))])])).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_ir_setup", "flow_repeat_forever", "esp_print", "dev_ir_value"]);
    expect(r.body[0].fields).toEqual({ PIN: 5 });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("준비되지 않은 이름의 ir_read() 는 장치 블록이 아니다", () => {
    expect(fromCode("print(remote.ir_read())\n").types).not.toContain("dev_ir_value");
  });
});
