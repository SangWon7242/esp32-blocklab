import { describe, expect, it } from "vitest";
import { FakeDevice } from "./fake";
import type { DeviceStatus, OutputEvent } from "./types";

function watch(d: FakeDevice) {
  const statuses: DeviceStatus[] = [];
  const out: OutputEvent[] = [];
  d.onStatus((s) => statuses.push(s));
  d.onOutput((e) => out.push(e));
  return { statuses, out, stdout: () => out.filter((e) => e.kind === "stdout").map((e) => e.text).join("") };
}

describe("FakeDevice", () => {
  it("상태 전이: connecting → connected → running → connected → disconnected", async () => {
    const d = new FakeDevice();
    const w = watch(d);
    expect(d.status).toBe("disconnected");
    await d.connect();
    await d.run("print(1)");
    await d.disconnect();
    expect(w.statuses).toEqual(["connecting", "connected", "running", "connected", "disconnected"]);
  });

  it("onStatus/onOutput 구독 해제", async () => {
    const d = new FakeDevice();
    const seen: DeviceStatus[] = [];
    const off = d.onStatus((s) => seen.push(s));
    off();
    await d.connect();
    expect(seen).toEqual([]);
  });

  it("print 줄마다 정해진 값: 숫자는 그대로, get_distance() 는 23, 문자열은 내용", async () => {
    const d = new FakeDevice();
    const w = watch(d);
    await d.connect();
    const code = [
      "from machine import Pin",
      "print(1)",
      "print('hi')",
      "    print(get_distance())",
      "print(3.5, \"cm\")",
      "# print(99)",
      "print()",
    ].join("\n");
    expect(await d.run(code)).toEqual({ ok: true });
    expect(w.stdout()).toBe("1\r\nhi\r\n23\r\n3.5 cm\r\n\r\n");
  });

  it("미리 정한 값을 바꿀 수 있다", async () => {
    const d = new FakeDevice({ values: { "temperature()": "21.5" } });
    const w = watch(d);
    await d.connect();
    await d.run("print(sensor.temperature())\nprint(get_distance())");
    expect(w.stdout()).toBe("21.5\r\n23\r\n");
  });

  it("raise 가 있으면 그 줄 번호로 Traceback 을 흉내 내고 멈춘다", async () => {
    const d = new FakeDevice();
    const w = watch(d);
    await d.connect();
    const r = await d.run("print(1)\nx = 2\nraise ValueError(\"x\")\nprint(2)");
    expect(w.stdout()).toBe("1\r\n");
    expect(r.ok).toBe(false);
    expect(r.error).toEqual({
      line: 3,
      message: "ValueError: x",
      traceback: "Traceback (most recent call last):\r\n  File \"<stdin>\", line 3, in <module>\r\nValueError: x\r\n",
    });
    expect(d.status).toBe("connected");
  });

  it("연결 전 실행은 disconnected 오류", async () => {
    await expect(new FakeDevice().run("print(1)")).rejects.toMatchObject({ code: "disconnected" });
  });

  it("saveFile/listFiles: 저장 중 상태와 파일 목록", async () => {
    const d = new FakeDevice();
    const w = watch(d);
    await d.connect();
    expect(await d.listFiles()).toEqual(["boot.py"]);
    await d.saveFile("main.py", "print(1)");
    expect(await d.listFiles()).toEqual(["boot.py", "main.py"]);
    expect(d.files.get("main.py")).toBe("print(1)");
    expect(w.statuses.slice(-2)).toEqual(["saving", "connected"]);
    await d.softReset();
  });

  it("멈춤: 실행 중이면 남은 줄을 건너뛰고 stopped", async () => {
    const d = new FakeDevice({ lineDelayMs: 20 });
    const w = watch(d);
    await d.connect();
    const p = d.run("print(1)\nprint(2)\nprint(3)");
    await new Promise((r) => setTimeout(r, 30));
    await d.stop();
    expect(await p).toEqual({ ok: true, stopped: true });
    expect(w.stdout()).toBe("1\r\n");
    expect(d.status).toBe("connected");
  });
});
