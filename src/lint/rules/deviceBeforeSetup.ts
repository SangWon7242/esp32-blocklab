import { findActionByBlock, findSetupByBlock, findValueByBlock, requiredKinds } from "@/devices/registry";
import type { DeviceSpec, SetupSpec } from "@/devices/types";
import { blockValues, fixedNameOf, objVarPart, setupDeviceLabel } from "../device";
import { deviceNoun, josa } from "../labels";
import { issueAt, realBlocks } from "../walk";
import type { Issue, Rule } from "../types";

type Provider = { setup: SetupSpec; device: DeviceSpec };

/**
 * 장치 블록이 쓰는 장치가 준비돼 있는지. 변수 칸이 있는 블록은 그 이름을 준비한 블록의 kind 가
 * requiredKinds 에 드는지, 고정 이름 블록(OLED·LCD·초음파…)은 자기 장치의 준비 블록이 작업판에 있는지 본다.
 */
export const deviceBeforeSetup: Rule = (ctx) => {
  const blocks = realBlocks(ctx);
  const names = new Map<string, Provider>();
  const setupTypes = new Set<string>();
  for (const b of blocks) {
    const setup = findSetupByBlock(b.type);
    if (!setup) continue;
    setupTypes.add(b.type);
    for (const n of setup.provides(blockValues(ctx, b, setup.parts))) if (!names.has(n)) names.set(n, { setup, device: setup.device });
  }

  const out: Issue[] = [];
  for (const b of blocks) {
    const spec = findActionByBlock(b.type) ?? findValueByBlock(b.type);
    if (!spec) continue;
    const kinds = requiredKinds(spec);
    if (!kinds.length) continue;
    const varPart = objVarPart(spec);
    if (varPart) {
      const name = blockValues(ctx, b, [varPart])[varPart.name];
      const expected = setupDeviceLabel(spec.device, kinds);
      const found = names.get(name);
      if (!found) {
        out.push(issueAt(ctx, b, "device-before-setup", "error", `${name} 를 먼저 준비해 주세요 (${expected} 블록)`, `NameError: name '${name}' is not defined`));
      } else if (!kinds.includes(found.setup.kind)) {
        out.push(issueAt(ctx, b, "device-before-setup", "error",
          `${name} 는 ${josa(found.device.label, ["이에요", "예요"])}. ${expected} 블록으로 준비해 주세요`,
          `TypeError: '${name}' is a ${found.setup.kind} device, not ${kinds.join(" or ")}`));
      }
      continue;
    }
    const own = spec.device.setup;
    if (!own || setupTypes.has(own.blockType)) continue;
    out.push(issueAt(ctx, b, "device-before-setup", "error",
      `${josa(deviceNoun(spec.device.id, spec.device.label), ["을", "를"])} 먼저 준비해 주세요`,
      `NameError: name '${fixedNameOf(spec, own)}' is not defined`));
  }
  return out;
};
