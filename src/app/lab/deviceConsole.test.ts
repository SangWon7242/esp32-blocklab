import { describe, expect, it } from "vitest";
import type { WorkspaceJson } from "@/codegen";
import {
  appendDeviceText, blockTypesIn, deviceRow, EMPTY_DEVICE_CONSOLE, MAX_DEVICE_ROWS, tracebackRow, type DeviceConsole,
} from "./deviceConsole";

const texts = (c: DeviceConsole) => c.rows.map((r) => r.text);

describe("appendDeviceText", () => {
  it("stdout 조각을 줄로 나누고, 끝나지 않은 줄은 다음 조각과 이어 붙인다", () => {
    let c = appendDeviceText(EMPTY_DEVICE_CONSOLE, "stdout", "1\r\n2");
    expect(texts(c)).toEqual(["1", "2"]);
    expect(c.open).toBe(true);
    c = appendDeviceText(c, "stdout", "3\r\n");
    expect(texts(c)).toEqual(["1", "23"]);
    expect(c.open).toBe(false);
    c = appendDeviceText(c, "stdout", "4\r\n");
    expect(texts(c)).toEqual(["1", "23", "4"]);
    expect(c.rows.every((r) => r.source === "device" && r.kind === "stdout" && r.level === "info")).toBe(true);
  });

  it("\\r 만 오거나 빈 줄도 줄로 친다 (빈 출력 줄은 남긴다)", () => {
    const c = appendDeviceText(EMPTY_DEVICE_CONSOLE, "stdout", "a\r\n\r\nb\n");
    expect(texts(c)).toEqual(["a", "", "b"]);
  });

  it("system 행은 열린 stdout 줄을 닫고 그 아래에 붙는다", () => {
    let c = appendDeviceText(EMPTY_DEVICE_CONSOLE, "stdout", "MicroPython v1.24");
    c = appendDeviceText(c, "system", "실행이 끝났어요");
    c = appendDeviceText(c, "stdout", ">>> ");
    expect(texts(c)).toEqual(["MicroPython v1.24", "실행이 끝났어요", ">>> "]);
    expect(c.rows.map((r) => r.kind)).toEqual(["stdout", "system", "stdout"]);
  });

  it(`최근 ${MAX_DEVICE_ROWS}행만 남긴다`, () => {
    let c = EMPTY_DEVICE_CONSOLE;
    for (let i = 0; i < MAX_DEVICE_ROWS + 20; i++) c = appendDeviceText(c, "stdout", `${i}\n`);
    expect(c.rows).toHaveLength(MAX_DEVICE_ROWS);
    expect(c.rows[0].text).toBe("20");
    expect(c.rows.at(-1)!.text).toBe(String(MAX_DEVICE_ROWS + 19));
  });
});

describe("deviceRow / tracebackRow", () => {
  it("system 행", () => {
    expect(deviceRow("system", "보드에 연결했어요")).toEqual({ source: "device", kind: "system", level: "info", text: "보드에 연결했어요" });
  });

  it("Traceback 은 영어 그대로 한 행, <stdin> 은 main.py 로, 줄 번호를 붙인다", () => {
    const traceback = 'Traceback (most recent call last):\r\n  File "<stdin>", line 2, in <module>\r\nValueError: x\r\n';
    expect(tracebackRow({ line: 2, message: "ValueError: x", traceback })).toEqual({
      source: "device",
      kind: "stderr",
      level: "error",
      text: 'Traceback (most recent call last):\n  File "main.py", line 2, in <module>\nValueError: x',
      line: 2,
    });
  });

  it("줄 번호가 없으면 line 을 두지 않는다", () => {
    const row = tracebackRow({ line: null, message: "MemoryError: ", traceback: "MemoryError: \r\n" });
    expect(row).toEqual({ source: "device", kind: "stderr", level: "error", text: "MemoryError:" });
  });
});

describe("blockTypesIn", () => {
  it("작업판 JSON 의 모든 블록 종류 (입력·그림자·다음 블록까지)", () => {
    const json = {
      blocks: {
        blocks: [
          {
            type: "esp_start",
            inputs: { DO: { block: { type: "dev_keypad_setup", next: { block: { type: "esp_print", inputs: { VALUE: { shadow: { type: "text" } } } } } } } },
          },
          { type: "esp_oled_setup" },
        ],
      },
    } as unknown as WorkspaceJson;
    expect(blockTypesIn(json).sort()).toEqual(["dev_keypad_setup", "esp_oled_setup", "esp_print", "esp_start", "text"]);
    expect(blockTypesIn(null)).toEqual([]);
  });
});
