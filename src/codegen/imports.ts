/** 생성된 본문을 보고 필요한 import 줄을 수업 저장소 순서(machine → ssd1306 → time)로 만든다. */
export function collectImports(text: string): string[] {
  const lines: string[] = [];
  const machine = ["Pin", "PWM", "SoftI2C"].filter((name) => new RegExp(`\\b${name}\\(`).test(text));
  if (machine.length) lines.push(`from machine import ${machine.join(", ")}`);
  if (/\bssd1306\./.test(text)) lines.push("import ssd1306");
  if (/\btime\./.test(text)) lines.push("import time");
  return lines;
}
