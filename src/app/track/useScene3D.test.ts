import { describe, expect, it } from "vitest";
import { loadScene3D, peekScene3D, scene3DKey, type Scene3D } from "@/track/wiring3d";
import { pickScene } from "./useScene3D";

const fake = (board: Scene3D["board"]) => ({ board }) as Scene3D;

describe("pickScene: 보드를 바꿀 때 그릴 장면", () => {
  const plus = fake("plus"), devkit = fake("devkit"), expansion = fake("expansion");

  it("받아 둔 장면이 있으면 기다리지 않고 그것", () => {
    expect(pickScene("k-devkit", devkit, { key: "k-plus", scene: plus })).toBe(devkit);
  });

  it("늦게 도착한 이전 보드의 장면은 버린다 (지금 이름표와 다르면 null)", () => {
    // plus → devkit → expansion 을 빠르게: devkit 장면이 늦게 와도 expansion 화면에 쓰지 않는다
    expect(pickScene("k-expansion", undefined, { key: "k-devkit", scene: devkit })).toBeNull();
    expect(pickScene("k-expansion", undefined, { key: "k-expansion", scene: expansion })).toBe(expansion);
  });

  it("3D 를 안 보면(이름표 없음) 장면도 없다", () => {
    expect(pickScene(undefined, plus, { key: "k-plus", scene: plus })).toBeNull();
  });
});

describe("loadScene3D · peekScene3D: 한 번 받은 장면은 바로", () => {
  it("받기 전에는 없고, 받은 뒤에는 같은 객체를 바로 준다", async () => {
    const ref = "images/wiring-led.expansion.svg";
    expect(scene3DKey("01-led", ref)).toBeDefined();
    expect(peekScene3D("01-led", ref)).toBeUndefined();
    const [a, b] = await Promise.all([loadScene3D("01-led", ref), loadScene3D("01-led", ref)]);
    expect(a).toBe(b);
    expect(peekScene3D("01-led", ref)).toBe(a);
    expect(await loadScene3D("01-led", ref)).toBe(a);
    expect(a?.board).toBe("expansion");
  });

  it("장면이 없는 그림은 이름표도 없다", () => {
    expect(scene3DKey("21-oled", "images/wiring-oled.svg")).toBeUndefined();
    expect(peekScene3D("01-led", "../x.svg")).toBeUndefined();
  });
});
