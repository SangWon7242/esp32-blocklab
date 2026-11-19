import { FakeDevice, WebSerialDevice, type Device } from "@/device";

/*
 * 화면 사이에서 함께 쓰는 보드 장치 (가짜·진짜 따로 하나씩).
 * 트랙 단계를 넘기면 편집기가 다시 마운트되는데, 그때마다 장치를 새로 만들고 끊으면 「보드 연결」을 또 눌러야 한다.
 * 그래서 장치는 모듈에 하나만 두고, 편집기(·앱 단계·진행 중인 저장)는 hold 로 "쓰는 중"만 알린다.
 *
 * 포트를 놓아 주는 때
 * 1. 학생이 「연결 끊기」를 누를 때 (화면이 device.disconnect 를 부른다)
 * 2. 페이지를 떠날 때 (pagehide)
 * 3. 쓰는 곳이 하나도 없는 채 IDLE_DISCONNECT_MS 가 지나면 (트랙을 떠나 다른 화면에 간 경우 — PyCharm·다른 탭이 쓸 수 있게).
 *    그 사이 다시 hold 하면 타이머를 취소한다.
 */

/** 쓰는 곳이 없을 때 연결을 유지하는 시간 */
export const IDLE_DISCONNECT_MS = 60_000;

/** 가짜 장치는 print 줄 사이를 잠깐 쉬어 "실행 중" 상태와 멈춤을 볼 수 있게 한다 */
const FAKE_LINE_DELAY_MS = 200;

export function createDevice(fake: boolean): Device {
  return fake ? new FakeDevice({ lineDelayMs: FAKE_LINE_DELAY_MS }) : new WebSerialDevice();
}

type Entry = { device: Device; users: number; timer: ReturnType<typeof setTimeout> | null };

/** 공유 장치 모음 (테스트가 만들 장치·시간을 바꿔 끼울 수 있게 클래스로 둔다) */
export class SharedDevices {
  private readonly entries = new Map<boolean, Entry>();
  private readonly create: (fake: boolean) => Device;
  private readonly idleMs: number;

  constructor(create: (fake: boolean) => Device = createDevice, idleMs: number = IDLE_DISCONNECT_MS) {
    this.create = create;
    this.idleMs = idleMs;
  }

  private entry(fake: boolean): Entry {
    let e = this.entries.get(fake);
    if (!e) {
      e = { device: this.create(fake), users: 0, timer: null };
      this.entries.set(fake, e);
    }
    return e;
  }

  /** 가짜/진짜 장치 하나 (몇 번 불러도 같은 것) */
  get(fake: boolean): Device {
    return this.entry(fake).device;
  }

  /** 지금 이 장치를 쓰는 곳 수 */
  users(fake: boolean): number {
    return this.entries.get(fake)?.users ?? 0;
  }

  /**
   * 이 장치를 쓰기 시작한다 (편집기 마운트, 진행 중인 저장). 돌려준 함수로 놓는다 (두 번 불러도 한 번만 센다).
   * 쓰는 곳이 0 이 되면 idleMs 뒤에 끊는다. 그 전에 다시 hold 하면 취소.
   */
  hold(fake: boolean): () => void {
    const e = this.entry(fake);
    e.users += 1;
    if (e.timer !== null) {
      clearTimeout(e.timer);
      e.timer = null;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      e.users -= 1;
      if (e.users > 0 || e.timer !== null) return;
      e.timer = setTimeout(() => {
        e.timer = null;
        if (e.users === 0 && e.device.status !== "disconnected") void e.device.disconnect().catch(() => undefined);
      }, this.idleMs);
    };
  }

  /** 모두 끊는다 (페이지를 떠날 때) */
  disconnectAll(): void {
    for (const e of this.entries.values()) {
      if (e.timer !== null) {
        clearTimeout(e.timer);
        e.timer = null;
      }
      if (e.device.status !== "disconnected") void e.device.disconnect().catch(() => undefined);
    }
  }
}

/**
 * 편집기가 언마운트될 때: 연결은 다음 화면이 이어 쓰도록 둔다. 이 편집기가 실행 중이면 멈춤(Ctrl-C)만 하고,
 * 저장 중이면 끝날 때까지 둔다 (중간에 끊으면 파일이 반쯤 써진다 — 저장은 따로 hold 하고 있다). 그리고 hold 를 놓는다.
 */
export function leaveDevice(device: Device, task: "run" | "save" | null, release: () => void): void {
  if (task === "run") void device.stop().catch(() => undefined);
  release();
}

let shared: SharedDevices | null = null;

/** 앱 전체가 함께 쓰는 모음. 처음 부를 때 만들고 pagehide 에 모두 끊게 한다 */
export function sharedDevices(): SharedDevices {
  if (!shared) {
    const s = new SharedDevices();
    shared = s;
    if (typeof window !== "undefined") window.addEventListener("pagehide", () => s.disconnectAll());
  }
  return shared;
}

/** 화면 사이에서 함께 쓰는 장치 (?device=fake 면 가짜) */
export function getSharedDevice(fake: boolean): Device {
  return sharedDevices().get(fake);
}
