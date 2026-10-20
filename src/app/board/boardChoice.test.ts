import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOARD_LABELS, BOARD_STORAGE_KEY, boardChoice, forgetBoardChoice, readStoredBoardChoice, setBoardChoice, subscribeBoardChoice,
} from "./boardChoice";

/*
 * 수업 보드 저장 (localStorage esp32-blocklab:board): 기본 plus, 모르는 값·막힌 저장소는 plus, 다른 탭의 storage 이벤트를 따른다.
 */

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

type Handler = (e: { key: string | null }) => void;

function stubWindow(localStorage: unknown) {
  const handlers = new Set<Handler>();
  vi.stubGlobal("window", {
    localStorage,
    addEventListener: (type: string, h: Handler) => type === "storage" && handlers.add(h),
    removeEventListener: (type: string, h: Handler) => type === "storage" && handlers.delete(h),
  });
  forgetBoardChoice();
  return handlers;
}

afterEach(() => {
  vi.unstubAllGlobals();
  forgetBoardChoice();
});

describe("boardChoice", () => {
  it("window 가 없으면(서버) plus 이고 바꿔도 throw 하지 않는다", () => {
    expect(readStoredBoardChoice()).toBe("plus");
    expect(boardChoice()).toBe("plus");
    setBoardChoice("devkit");
    expect(boardChoice()).toBe("devkit");
  });

  it("저장한 값을 읽고, devkit 은 저장하고 plus 로 돌리면 지운다", () => {
    const s = memoryStorage({ [BOARD_STORAGE_KEY]: "devkit" });
    stubWindow(s);
    expect(boardChoice()).toBe("devkit");
    setBoardChoice("plus");
    expect(s.data.has(BOARD_STORAGE_KEY)).toBe(false);
    setBoardChoice("devkit");
    expect(s.data.get(BOARD_STORAGE_KEY)).toBe("devkit");
  });

  it("모르는 값은 plus, 모르는 id 로 바꾸기는 무시", () => {
    stubWindow(memoryStorage({ [BOARD_STORAGE_KEY]: "uno" }));
    expect(boardChoice()).toBe("plus");
    setBoardChoice("uno" as never);
    expect(boardChoice()).toBe("plus");
  });

  it("저장소가 throw 해도 plus 로 읽고, 바꾼 값은 이 화면에서 유지된다", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    stubWindow(broken);
    expect(boardChoice()).toBe("plus");
    setBoardChoice("devkit");
    expect(boardChoice()).toBe("devkit");
    // localStorage 접근 자체가 throw 하는 브라우저
    vi.stubGlobal("window", Object.defineProperty({ addEventListener() {}, removeEventListener() {} }, "localStorage", { get: () => { throw new Error("denied"); } }));
    forgetBoardChoice();
    expect(boardChoice()).toBe("plus");
  });

  it("바꾸면 구독자에게 알리고, 다른 탭의 storage 이벤트를 따른다", () => {
    const s = memoryStorage();
    const handlers = stubWindow(s);
    const seen: string[] = [];
    const off = subscribeBoardChoice(() => seen.push(boardChoice()));
    expect(handlers.size).toBe(1);
    setBoardChoice("devkit");
    setBoardChoice("devkit"); // 같은 값은 알리지 않는다
    expect(seen).toEqual(["devkit"]);
    // 다른 탭이 plus 로 되돌림
    s.data.delete(BOARD_STORAGE_KEY);
    handlers.forEach((h) => h({ key: BOARD_STORAGE_KEY }));
    // 상관없는 키는 무시
    s.data.set(BOARD_STORAGE_KEY, "devkit");
    handlers.forEach((h) => h({ key: "other" }));
    expect(seen).toEqual(["devkit", "plus"]);
    off();
    expect(handlers.size).toBe(0);
  });

  it("라벨은 한국어 두 개", () => {
    expect(BOARD_LABELS.plus).toBe("ESP32 Plus 확장 보드");
    expect(BOARD_LABELS.devkit).toBe("기본 보드 (DevKit 30핀)");
  });
});
