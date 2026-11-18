import { describe, expect, it } from "vitest";

import * as lib from "./index";

describe("라이브러리 입구 — 보드 연결", () => {
  it("허브가 쓸 보드 연결을 내보낸다", () => {
    expect(typeof lib.WebSerialDevice).toBe("function");
    expect(typeof lib.FakeDevice).toBe("function");
    expect(typeof lib.DeviceError).toBe("function");
    expect(lib.DEVICE_ERROR_MESSAGES.unsupported).toBe("Chrome에서 열어 주세요");
  });

  it("가짜 보드로 set_color 를 실행해도 오류가 없다", async () => {
    const device = new lib.FakeDevice();
    await device.connect();
    const result = await device.run("def set_color(r, g, b):\n    pass\nset_color(255, 0, 0)\n");
    expect(result.ok).toBe(true);
  });
});
