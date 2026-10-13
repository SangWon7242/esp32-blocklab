import { describe, expect, it, vi } from "vitest";
import { DeviceError, FakeDevice } from "@/device";
import { saveToBoard } from "./saveToBoard";

async function connected() {
  const device = new FakeDevice();
  await device.connect();
  return device;
}

describe("saveToBoard", () => {
  it("쓰인 블록의 라이브러리 중 보드에 없는 것만 올리고, main.py 를 저장한 뒤 소프트 리셋", async () => {
    const device = await connected();
    device.files.set("ssd1306.py", "# ssd1306.py");
    const reset = vi.spyOn(device, "softReset");
    const fetchLibs = vi.fn(async (names: string[]) => names.map((name) => ({ name, text: `# ${name}` })));
    const log: string[] = [];
    await saveToBoard(device, { code: "print(1)\n", blockTypes: ["esp_oled_setup", "dev_keypad_setup", "esp_print"] }, (t) => log.push(t), fetchLibs);
    expect(fetchLibs).toHaveBeenCalledWith(["ssd1306.py", "keypad.py"]);
    expect(device.files.get("keypad.py")).toBe("# keypad.py");
    expect(device.files.get("ssd1306.py")).toBe("# ssd1306.py");
    expect(device.files.get("main.py")).toBe("print(1)\n");
    expect(reset).toHaveBeenCalledTimes(1);
    expect(log).toEqual(["keypad.py 올리는 중…", "main.py 올리는 중…", "main.py 저장 완료", "보드를 다시 시작했어요 (main.py 가 실행돼요)"]);
  });

  it("보드의 라이브러리가 옛 판(크기가 다름)이면 새 판으로 바꾼다", async () => {
    const device = await connected();
    device.files.set("ssd1306.py", "# old keyestudio driver without line/rect");
    const fetchLibs = vi.fn(async (names: string[]) => names.map((name) => ({ name, text: `# ${name}` })));
    const log: string[] = [];
    await saveToBoard(device, { code: "x\n", blockTypes: ["esp_oled_setup"] }, (t) => log.push(t), fetchLibs);
    expect(device.files.get("ssd1306.py")).toBe("# ssd1306.py");
    expect(log[0]).toBe("ssd1306.py 새 판으로 바꾸는 중…");
  });

  it("라이브러리가 필요 없으면 보드 파일 목록도 읽지 않는다", async () => {
    const device = await connected();
    const list = vi.spyOn(device, "fileSizes");
    const fetchLibs = vi.fn();
    await saveToBoard(device, { code: "x = 1\n", blockTypes: ["esp_pin_setup"] }, () => undefined, fetchLibs);
    expect(list).not.toHaveBeenCalled();
    expect(fetchLibs).not.toHaveBeenCalled();
    expect(device.files.get("main.py")).toBe("x = 1\n");
  });

  it("라이브러리를 못 읽으면 main.py 를 저장하지 않고 오류를 넘긴다", async () => {
    const device = await connected();
    const fetchLibs = vi.fn(async () => { throw new Error("keypad.py 라이브러리를 불러오지 못했어요 (404)"); });
    await expect(saveToBoard(device, { code: "x\n", blockTypes: ["dev_keypad_setup"] }, () => undefined, fetchLibs)).rejects.toThrow("(404)");
    expect(device.files.has("main.py")).toBe(false);
  });

  it("보드 쪽 저장·목록 실패는 한국어로 감싼다 (장치 오류 문구는 그대로)", async () => {
    const device = await connected();
    vi.spyOn(device, "saveFile").mockRejectedValueOnce(new Error("OSError: 28"));
    await expect(saveToBoard(device, { code: "x\n", blockTypes: [] }, () => undefined)).rejects.toThrow("보드에 저장하지 못했어요: OSError: 28");
    vi.spyOn(device, "fileSizes").mockRejectedValueOnce(new Error("OSError: 5"));
    const fetchLibs = vi.fn(async (names: string[]) => names.map((name) => ({ name, text: `# ${name}` })));
    await expect(saveToBoard(device, { code: "x\n", blockTypes: ["dev_keypad_setup"] }, () => undefined, fetchLibs)).rejects.toThrow("보드에 저장하지 못했어요: OSError: 5");
    const lost = new DeviceError("disconnected");
    vi.spyOn(device, "saveFile").mockRejectedValueOnce(lost);
    await expect(saveToBoard(device, { code: "x\n", blockTypes: [] }, () => undefined)).rejects.toBe(lost);
  });
});
