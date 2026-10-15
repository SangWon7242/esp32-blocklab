import { findSetupByBlock } from "@/devices/registry";
import { ADC_PINS, TOUCH_PINS } from "@/devices/specs/common";
import { blockValues, setupPins } from "../device";
import { issueAt, realBlocks } from "../walk";
import type { Rule } from "../types";

/** 준비 블록의 핀 번호: 0~39 밖, 입력 전용 핀(34~39)에 출력·버스, ADC 없는 핀에 아날로그 입력, 터치 핀이 아닌 핀에 터치 패드(주의) */
export const pinRule: Rule = (ctx) =>
  realBlocks(ctx).flatMap((b) => {
    const setup = findSetupByBlock(b.type);
    if (!setup) return [];
    return setupPins(setup, blockValues(ctx, b, setup.parts)).flatMap(({ pin, dir }) => {
      if (!Number.isInteger(pin) || pin < 0 || pin > 39)
        return [issueAt(ctx, b, "pin-rule", "error", `${pin}번 핀은 없어요 (0~39)`, `ValueError: invalid pin ${pin}`)];
      if ((dir === "out" || dir === "bus") && pin >= 34)
        return [issueAt(ctx, b, "pin-rule", "error", `${pin}번 핀은 입력만 할 수 있어요`, `ValueError: pin ${pin} is input-only`)];
      if (dir === "adc" && !ADC_PINS.includes(pin))
        return [issueAt(ctx, b, "pin-rule", "error", `${pin}번 핀은 아날로그 입력을 할 수 없어요 (32~39, 25~27 등)`, `ValueError: pin ${pin} has no ADC`)];
      if (dir === "touch" && !TOUCH_PINS.includes(pin))
        return [issueAt(ctx, b, "pin-rule", "warning", `${pin}번 핀은 터치 핀이 아니에요 (4, 0, 2, 15, 13, 12, 14, 27, 33, 32)`, `ValueError: pin ${pin} has no touch pad`)];
      return [];
    });
  });
