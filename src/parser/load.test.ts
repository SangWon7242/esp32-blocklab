import { describe, expect, it } from "vitest";
import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks, normalizeCode } from "./index";

// 파서가 낸 JSON 은 Blockly 연결 형식 검사를 통과해 그대로 올라가야 한다
const cases: { src: string; fallsBack: boolean }[] = [
  { src: "while 1:\n    pass\n", fallsBack: true },
  { src: "d = 3\nif d % 2:\n    print(d)\n", fallsBack: true },
  { src: 'import time\ntime.sleep("1")\n', fallsBack: true },
  { src: "x = 2\nfor i in range(x + 1):\n    pass\n", fallsBack: false },
];

describe("형식 검사에 맞지 않는 식은 코드 식으로 떨어진다", () => {
  for (const { src, fallsBack } of cases) {
    it(JSON.stringify(src), () => {
      const r = codeToBlocks(src);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      let out = "";
      expect(() => { out = workspaceJsonToCode(r.json); }).not.toThrow();
      expect(normalizeCode(out)).toEqual(normalizeCode(src));
      if (fallsBack) expect(r.unparsed.length).toBeGreaterThan(0);
      else expect(r.unparsed).toEqual([]);
    });
  }
});
