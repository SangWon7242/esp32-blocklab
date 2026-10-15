import { findSetupByBlock } from "@/devices/registry";
import { ADC2_PINS } from "@/devices/specs/common";
import { blockValues, setupPins } from "../device";
import { issueAt, realBlocks } from "../walk";
import type { FlatBlock, LintContext, Rule } from "../types";

/** WiFi 를 켜는 준비 블록이 있는지 (연결·공유기 모드) */
const usesWifi = (blocks: FlatBlock[]) => blocks.some((b) => findSetupByBlock(b.type)?.device.id === "wifi");

/**
 * WiFi 를 쓰는 동안 ADC2 핀(0·2·4·12~15·25~27)은 아날로그 값을 읽을 수 없다 (ESP32 는 WiFi 가 ADC2 를 함께 쓴다).
 * WiFi 준비 블록이 있을 때 아날로그 입력(dir adc) 핀이 ADC2 쪽이면 주의.
 */
export const wifiAdc2: Rule = (ctx) => {
  const blocks = realBlocks(ctx);
  if (!usesWifi(blocks)) return [];
  return blocks.flatMap((b) => {
    const setup = findSetupByBlock(b.type);
    if (!setup) return [];
    return setupPins(setup, blockValues(ctx, b, setup.parts))
      .filter(({ pin, dir }) => dir === "adc" && ADC2_PINS.includes(pin))
      .map(({ pin }) =>
        issueAt(ctx, b, "wifi-adc2", "warning", "WiFi 를 쓰는 동안 이 핀은 아날로그 값을 못 읽어요. 32~39 번 핀으로 옮겨 주세요",
          `Warning: ADC2 pin ${pin} can't be read while WiFi is on (use pins 32-39)`),
      );
  });
};

/** 몸통(DO)에 담긴 블록이 되풀이되는 반복 */
const LOOPS = new Set(["flow_repeat_forever", "flow_repeat_n", "controls_whileUntil", "flow_for_each", "flow_for_range", "flow_for_range_step"]);
const DEFS = new Set(["procedures_defnoreturn", "procedures_defreturn"]);

/** 반복 몸통 안이거나 함수 몸통 안인지 (함수는 반복 안에서 부를 수 있으므로 따지지 않는다) */
function repeated(ctx: LintContext, b: FlatBlock): boolean {
  let cur: FlatBlock | undefined = b;
  while (cur?.parentId) {
    const parent = ctx.byId.get(cur.parentId);
    if (!parent) return false;
    if (DEFS.has(parent.type) || (LOOPS.has(parent.type) && cur.inputName === "DO")) return true;
    cur = parent;
  }
  return false;
}

/** 요청 받기가 반복 밖에 있으면 손님(브라우저) 한 번만 받고 프로그램이 끝난다 */
export const webAcceptOutsideLoop: Rule = (ctx) =>
  realBlocks(ctx).flatMap((b) =>
    b.type === "dev_web_accept" && !repeated(ctx, b)
      ? [issueAt(ctx, b, "web-accept-outside-loop", "warning", "요청 받기는 계속 반복 안에 두어야 여러 번 받을 수 있어요", "Warning: web_accept() outside a loop answers only one request")]
      : [],
  );
