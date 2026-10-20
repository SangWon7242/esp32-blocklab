import { DEVICES, defaultValues } from "@/devices/registry";
import { HELPER_MARK } from "@/devices/specs/common";
import type { ActionSpec, DeviceSpec, Part, PinDir, SetupSpec, ValueSpec, Values } from "@/devices/types";
import type { FlatBlock, LintContext } from "./types";

/** 블록의 칸 값 (변수 칸은 변수 이름으로, 빠진 칸은 기본값) — 레지스트리 provides·lines 가 받는 꼴 */
export function blockValues(ctx: LintContext, b: FlatBlock, parts: Part[]): Values {
  const v = defaultValues(parts);
  for (const p of parts) {
    if (p.kind === "value" || !(p.name in b.fields)) continue;
    const raw = b.fields[p.name];
    if (p.kind === "var") v[p.name] = ctx.varName(raw) ?? v[p.name];
    else if (raw !== null && raw !== undefined) v[p.name] = String(raw);
  }
  return v;
}

/** 준비 블록의 핀 칸들: 칸 이름, 번호, 쓰임(out·in·adc·bus) */
export function setupPins(spec: SetupSpec, values: Values): { part: string; pin: number; dir: PinDir }[] {
  return spec.parts.flatMap((p) => {
    if (p.kind !== "pin") return [];
    const dir = p.dir === "mode" ? (values[p.modeField ?? "MODE"] === "IN" ? "in" : "out") : p.dir;
    return [{ part: p.name, pin: Number(values[p.name]), dir }];
  });
}

/** 핀 칸을 쓰는 이름: provides 중 칸 이름과 같은 것(초음파 TRIG → trig), 없으면 첫 이름 */
export function pinOwnerName(spec: SetupSpec, values: Values, part: string): string {
  const names = spec.provides(values);
  return names.find((n) => n === part.toLowerCase()) ?? names[0] ?? spec.blockType;
}

/** 명령·값 블록이 장치를 가리키는 변수 칸 (패턴의 objPart, 없으면 첫 변수 칸) */
export function objVarPart(spec: ActionSpec | ValueSpec): Part | undefined {
  const p = spec.pattern;
  const objPart = "objPart" in p ? p.objPart : undefined;
  return spec.parts.find((x) => x.kind === "var" && (!objPart || x.name === objPart)) ?? spec.parts.find((x) => x.kind === "var");
}

/** 고정 이름 장치 블록이 코드에서 부르는 이름 (oled.fill(0) → oled, get_distance() → get_distance) */
export function fixedNameOf(spec: ActionSpec | ValueSpec, setup: SetupSpec): string {
  const provided = setup.provides(defaultValues(setup.parts));
  let code = "";
  try {
    code = spec.code(defaultValues(spec.parts)).replaceAll(HELPER_MARK, "");
  } catch {
    code = "";
  }
  const head = /^[A-Za-z_]\w*/.exec(code.trim())?.[0];
  // 도우미를 부르는 블록(show(a, b)·get_distance())은 그 도우미 이름, 보드 라이브러리 함수를 부르는 블록(web_send(…))은 그 함수 이름
  return head && (provided.includes(head) || spec.helpers?.some((h) => h.name === head) || setup.libNames?.includes(head)) ? head : (provided[0] ?? setup.blockType);
}

/**
 * kind 장치를 준비하는 블록의 장치 이름 (안내 문구용). 자기 장치가 그 kind 를 준비하면 자기 것,
 * 아니면 같은 카테고리(alsoIn 포함)에서 그 kind 를 준비하는 장치, 그것도 없으면 처음 찾은 장치.
 */
export function setupDeviceLabel(own: DeviceSpec, kinds: string[]): string {
  if (own.setup && kinds.includes(own.setup.kind)) return own.label;
  const kind = kinds[0];
  const sameCategory = DEVICES.find((d) => d.setup?.kind === kind && (d.category === own.category || d.alsoIn?.includes(own.category)));
  return (sameCategory ?? DEVICES.find((d) => d.setup?.kind === kind))?.label ?? own.label;
}
