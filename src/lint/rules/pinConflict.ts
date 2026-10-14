import { findSetupByBlock } from "@/devices/registry";
import { blockValues, pinOwnerName, setupPins } from "../device";
import { issueAt, realBlocks } from "../walk";
import type { Issue, Rule } from "../types";

/**
 * 같은 핀 번호를 두 준비 블록이 쓴다 → 나중 블록에 주의 (한 블록 안에서 겹치는 것은 보지 않는다).
 * 예외: I2C 처럼 여러 장치가 **같은 버스 선**(SCL↔SCL, SDA↔SDA)을 나눠 쓰는 것은 정상이라 주의하지 않는다 (9장 OLED+RFID).
 */
export const pinConflict: Rule = (ctx) => {
  const first = new Map<number, { blockId: string; name: string; part: string; dir: string }>();
  const out: Issue[] = [];
  for (const b of realBlocks(ctx)) {
    const setup = findSetupByBlock(b.type);
    if (!setup) continue;
    const values = blockValues(ctx, b, setup.parts);
    for (const { part, pin, dir } of setupPins(setup, values)) {
      if (!Number.isInteger(pin)) continue;
      const name = pinOwnerName(setup, values, part);
      const prev = first.get(pin);
      if (!prev) first.set(pin, { blockId: b.id, name, part, dir });
      else if (prev.blockId !== b.id && !(dir === "bus" && prev.dir === "bus" && part.toUpperCase() === prev.part.toUpperCase()))
        out.push(issueAt(ctx, b, "pin-conflict", "warning", `${pin}번 핀을 ${name} 와 ${prev.name} 가 같이 쓰고 있어요`, `Warning: pin ${pin} used by ${name} and ${prev.name}`));
    }
  }
  return out;
};
