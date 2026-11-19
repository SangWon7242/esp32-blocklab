import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDevice } from "@/device";
import { getSharedDevice, IDLE_DISCONNECT_MS, leaveDevice, SharedDevices } from "./sharedDevice";

/** 편집기 하나가 마운트됐다가 언마운트되는 것처럼 (useDevice 의 effect 와 같은 순서) */
function mount(shared: SharedDevices, fake = true) {
  const device = shared.get(fake);
  const release = shared.hold(fake);
  return { device, unmount: (task: "run" | "save" | null = null) => leaveDevice(device, task, release) };
}

describe("SharedDevices (화면 사이 공유 장치)", () => {
  let shared: SharedDevices;
  beforeEach(() => {
    vi.useFakeTimers();
    shared = new SharedDevices(() => new FakeDevice());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("두 번 마운트해도 같은 장치, 가짜/진짜는 따로", () => {
    const a = mount(shared, true);
    const b = mount(shared, true);
    expect(a.device).toBe(b.device);
    expect(shared.get(false)).not.toBe(a.device);
    expect(shared.users(true)).toBe(2);
  });

  it("언마운트해도 연결은 유지된다 → 다음 편집기가 바로 연결됨으로 본다", async () => {
    const first = mount(shared);
    await first.device.connect();
    first.unmount();
    const next = mount(shared);
    expect(next.device.status).toBe("connected");
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS * 2);
    expect(next.device.status).toBe("connected");
  });

  it("실행 중 언마운트는 멈춤만 (연결은 유지)", async () => {
    // 줄 사이 쉬는 시간이 있어야 "실행 중" 에 언마운트할 수 있다
    const slow = new SharedDevices(() => new FakeDevice({ lineDelayMs: 100 }));
    const editor = mount(slow);
    await editor.device.connect();
    const running = editor.device.run("print(1)\nprint(2)\nprint(3)");
    expect(editor.device.status).toBe("running");
    const stop = vi.spyOn(editor.device, "stop");
    const disconnect = vi.spyOn(editor.device, "disconnect");
    editor.unmount("run");
    expect(stop).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    await expect(running).resolves.toEqual({ ok: true, stopped: true });
    expect(editor.device.status).toBe("connected");
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("실행 중이 아니면 언마운트해도 멈춤·끊기를 부르지 않는다", async () => {
    const editor = mount(shared);
    await editor.device.connect();
    const stop = vi.spyOn(editor.device, "stop");
    const disconnect = vi.spyOn(editor.device, "disconnect");
    editor.unmount(null);
    expect(stop).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("저장 중 언마운트는 저장이 끝날 때까지 둔다 (저장이 hold 하는 동안 쉬는 시간 끊김 없음)", async () => {
    const editor = mount(shared);
    await editor.device.connect();
    const saveHold = shared.hold(true); // useDevice.begin("save")
    const stop = vi.spyOn(editor.device, "stop");
    editor.unmount("save");
    expect(stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS * 3);
    expect(editor.device.status).toBe("connected");
    saveHold(); // 저장 끝 → 이제 쉬는 시간 시작
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS);
    expect(editor.device.status).toBe("disconnected");
  });

  it("마운트 0개로 60초가 지나면 끊는다", async () => {
    const editor = mount(shared);
    await editor.device.connect();
    editor.unmount();
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS - 1);
    expect(editor.device.status).toBe("connected");
    await vi.advanceTimersByTimeAsync(1);
    expect(editor.device.status).toBe("disconnected");
  });

  it("다시 마운트하면 끊김 타이머를 취소한다", async () => {
    const editor = mount(shared);
    await editor.device.connect();
    editor.unmount();
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS - 1000);
    const again = mount(shared);
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS * 2);
    expect(again.device.status).toBe("connected");
    // 다시 떠나면 그때부터 새로 60초
    again.unmount();
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS - 1);
    expect(again.device.status).toBe("connected");
    await vi.advanceTimersByTimeAsync(1);
    expect(again.device.status).toBe("disconnected");
  });

  it("한 편집기만 떠나면 끊김 타이머가 돌지 않는다 (아직 쓰는 곳이 있다)", async () => {
    const a = mount(shared);
    mount(shared);
    await a.device.connect();
    a.unmount();
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS * 2);
    expect(a.device.status).toBe("connected");
  });

  it("놓기를 두 번 불러도 한 번만 센다", () => {
    const release = shared.hold(true);
    shared.hold(true);
    release();
    release();
    expect(shared.users(true)).toBe(1);
  });

  it("disconnectAll (페이지를 떠날 때) 은 쓰는 곳이 있어도 끊는다", async () => {
    const editor = mount(shared);
    await editor.device.connect();
    shared.disconnectAll();
    await Promise.resolve();
    expect(editor.device.status).toBe("disconnected");
  });

  it("이미 끊긴 장치는 60초 뒤에도 다시 끊지 않는다", async () => {
    const editor = mount(shared);
    const disconnect = vi.spyOn(editor.device, "disconnect");
    editor.unmount();
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS);
    expect(disconnect).not.toHaveBeenCalled();
  });
});

describe("getSharedDevice", () => {
  it("모듈 수준에서 같은 장치를 돌려준다", () => {
    expect(getSharedDevice(true)).toBe(getSharedDevice(true));
    expect(getSharedDevice(true)).toBeInstanceOf(FakeDevice);
    expect(getSharedDevice(true)).not.toBe(getSharedDevice(false));
  });
});
