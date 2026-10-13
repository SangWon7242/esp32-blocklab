import { findSetupByBlock } from "@/devices/registry";
import { blockValues, pinOwnerName, setupPins } from "../device";
import { issueAt, realBlocks } from "../walk";
import type { Issue, Rule } from "../types";

/** 같은 핀 번호를 두 준비 블록이 쓴다 → 나중 블록에 주의 (한 블록 안에서 겹치는 것은 보지 않는다) */
export const pinConflict: Rule = (ctx) => {
  const first = new Map<number, { blockId: string; name: string }>();
  const out: Issue[] = [];
  for (const b of realBlocks(ctx)) {
    const setup = findSetupByBlock(b.type);
    if (!setup) continue;
    const values = blockValues(ctx, b, setup.parts);
    for (const { part, pin } of setupPins(setup, values)) {
      if (!Number.isInteger(pin)) continue;
      const name = pinOwnerName(setup, values, part);
      const prev = first.get(pin);
      if (!prev) first.set(pin, { blockId: b.id, name });
      else if (prev.blockId !== b.id)
        out.push(issueAt(ctx, b, "pin-conflict", "warning", `${pin}번 핀을 ${name} 와 ${prev.name} 가 같이 쓰고 있어요`, `Warning: pin ${pin} used by ${name} and ${prev.name}`));
    }
  }
  return out;
};
