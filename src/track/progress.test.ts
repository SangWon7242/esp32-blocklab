import { describe, expect, it } from "vitest";
import { emptyProgress, LocalProgressStore, STORAGE_KEY, type StorageLike } from "./progress";

class MapStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

const rec = (status: "open" | "done", input: Record<string, unknown> = {}) => ({ status, input, attempts: 1, updatedAt: "2026-10-14T00:00:00.000Z" });

describe("LocalProgressStore", () => {
  it("빈 저장소는 빈 진행 기록 (version 1)", async () => {
    const store = new LocalProgressStore(new MapStorage());
    expect(await store.load()).toEqual(emptyProgress());
    expect(emptyProgress()).toEqual({ version: 1, chapters: {} });
  });

  it("saveStep 은 키 esp32-blocklab:v1 에 챕터·단계별로 쌓는다", async () => {
    const storage = new MapStorage();
    const store = new LocalProgressStore(storage);
    await store.saveStep("10-auto-door", "problem", rec("done", { q0: "초음파" }));
    await store.saveStep("10-auto-door", "analysis", rec("open"));
    await store.saveStep("01-led", "problem", rec("open"));
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(STORAGE_KEY).toBe("esp32-blocklab:v1");
    expect(Object.keys(saved.chapters["10-auto-door"])).toEqual(["problem", "analysis"]);
    expect((await new LocalProgressStore(storage).load()).chapters["10-auto-door"].problem.input).toEqual({ q0: "초음파" });
  });

  it("saveLabProject 는 lab 에 담는다", async () => {
    const store = new LocalProgressStore(new MapStorage());
    await store.saveLabProject({ code: "print(1)" });
    expect((await store.load()).lab).toEqual({ code: "print(1)" });
  });

  it("왕복: export → clear → import 하면 그대로 돌아온다", async () => {
    const store = new LocalProgressStore(new MapStorage());
    await store.saveStep("10-auto-door", "readcheck1", rec("done", { answers: [0, 2, 2] }));
    await store.saveLabProject({ code: "x = 1" });
    const before = await store.load();
    const json = await store.exportJson();
    await store.clear();
    expect(await store.load()).toEqual(emptyProgress());
    await store.importJson(json);
    expect(await store.load()).toEqual(before);
  });

  it("importJson 은 형식이 틀리면 거부하고 기존 기록을 지킨다", async () => {
    const store = new LocalProgressStore(new MapStorage());
    await store.saveStep("01-led", "problem", rec("done"));
    const before = await store.load();
    await expect(store.importJson("not json")).rejects.toThrow();
    await expect(store.importJson(JSON.stringify({ version: 2, chapters: {} }))).rejects.toThrow();
    await expect(store.importJson(JSON.stringify({ version: 1, chapters: { x: { y: { status: "done" } } } }))).rejects.toThrow();
    expect(await store.load()).toEqual(before);
  });

  it("저장소 글이 깨져 있으면 빈 기록으로 시작하고 원문은 따로 남긴다", async () => {
    const storage = new MapStorage();
    storage.setItem(STORAGE_KEY, "{broken");
    const store = new LocalProgressStore(storage);
    expect(await store.load()).toEqual(emptyProgress());
    expect(storage.getItem(`${STORAGE_KEY}:corrupt`)).toBe("{broken");
  });
});
