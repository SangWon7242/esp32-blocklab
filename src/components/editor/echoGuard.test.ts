import { describe, expect, it } from "vitest";
import { createEchoGuard } from "./echoGuard";

describe("createEchoGuard", () => {
  it("편집기가 보낸 글을 그대로 돌려받으면 메아리다", () => {
    const g = createEchoGuard();
    g.emitted("abc");
    expect(g.isEcho("abc")).toBe(true);
  });

  it("debounce 뒤 늦게 도착한 옛 글도 메아리다 (그 사이 한 글자 더 쳤어도)", () => {
    const g = createEchoGuard();
    g.emitted("abc");
    g.emitted("abcd");
    expect(g.isEcho("abc")).toBe(true);
    expect(g.isEcho("abcd")).toBe(true);
  });

  it("한 번 확인한 메아리보다 앞선 글은 버린다", () => {
    const g = createEchoGuard();
    g.emitted("a");
    g.emitted("ab");
    expect(g.isEcho("ab")).toBe(true);
    expect(g.isEcho("a")).toBe(false);
  });

  it("보낸 적 없는 글(블록에서 다시 만든 코드)은 메아리가 아니고 기록을 비운다", () => {
    const g = createEchoGuard();
    g.emitted("abc");
    expect(g.isEcho("from machine import Pin\n")).toBe(false);
    expect(g.isEcho("abc")).toBe(false);
  });

  it("reset 뒤에는 예전에 보낸 글도 메아리가 아니다", () => {
    const g = createEchoGuard();
    g.emitted("abc");
    g.reset();
    expect(g.isEcho("abc")).toBe(false);
  });
});
