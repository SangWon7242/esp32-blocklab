/*
 * 선언 파일에서 zod 를 걷어 낸다 (lib-v1.0.1, build-lib.mjs 가 부른다).
 * 허브에는 zod 가 없어서 `import { z } from "zod"` 가 남은 d.ts 의 `z.infer<…>` 타입(StepRecord·Progress·Chapter·Step …)이
 * 허브에서 모두 any 로 풀렸다. 그래서 zod 를 import 하는 d.ts 마다 TypeScript 검사기로 타입을 펼쳐 평범한 타입으로 다시 쓴다.
 *   - `export type X = z.infer<typeof S>` 처럼 z. 를 쓰는 타입 별칭 → 검사기가 계산한 실제 모양(객체·합집합)으로
 *   - `export declare const S: z.ZodObject<…>` 같은 스키마 값 → `BlocklabSchema<출력 모양>` (parse·safeParse 만 있는 작은 모양)
 *   - `import { z } from "zod"` 는 지운다
 * 펼친 결과가 zod 로 계산한 원래 타입과 양쪽으로 할당되는지는 scripts/lib-types-check.mjs 가 확인한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const FLAGS = ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.InTypeAlias | ts.NodeBuilderFlags.MultilineObjectLiterals;
const printer = ts.createPrinter({ removeComments: false });

/** 검사기가 계산한 타입을 여러 줄 타입 글로 */
function printType(checker, type, at, sf) {
  const node = checker.typeToTypeNode(type, at, FLAGS);
  if (!node) throw new Error(`타입을 글로 못 바꿨어요: ${at.getText(sf).slice(0, 80)}`);
  return printer.printNode(ts.EmitHint.Unspecified, node, sf);
}

const SCHEMA_TYPE = `/** zod 스키마 자리 (선언에서 zod 를 뺐다 — lib-v1.0.1). 값은 실제 zod 스키마다 */
type BlocklabSchema<T> = {
    parse(data: unknown): T;
    safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
};
`;

const usesZod = (text) => /\bz\.[A-Za-z]/.test(text);

/**
 * @param {string[]} files zod 를 import 하는 d.ts 절대 경로들 (같은 프로그램으로 함께 읽는다)
 * @returns {{ file: string; aliases: number; consts: number }[]}
 */
export function stripZodFromDts(files) {
  const program = ts.createProgram(files, {
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
  });
  const checker = program.getTypeChecker();
  const results = [];
  const edits = new Map();
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) throw new Error(`선언 파일을 못 읽었어요: ${file}`);
    const repl = [];
    // `type X = z.infer<typeof S>` 이면 스키마 S 는 BlocklabSchema<X> 로 (모양을 두 번 펼치지 않게)
    const aliasOf = new Map();
    for (const st of sf.statements) {
      if (!ts.isTypeAliasDeclaration(st) || st.typeParameters) continue;
      const m = /^z\.infer<typeof (\w+)>$/.exec(st.type.getText(sf).replace(/\s+/g, ""));
      if (m) aliasOf.set(m[1], st.name.text);
    }
    let aliases = 0;
    let consts = 0;
    for (const st of sf.statements) {
      const text = st.getText(sf);
      if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.moduleSpecifier.text === "zod") {
        repl.push([st.getStart(sf), st.end, ""]);
        continue;
      }
      if (ts.isTypeAliasDeclaration(st) && usesZod(st.type.getText(sf))) {
        const type = checker.getTypeAtLocation(st.name);
        const printed = printType(checker, type, st, sf);
        const params = st.typeParameters ? `<${st.typeParameters.map((p) => p.getText(sf)).join(", ")}>` : "";
        const exported = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? "export " : "";
        repl.push([st.getStart(sf), st.end, `${exported}type ${st.name.text}${params} = ${printed};`]);
        aliases++;
        continue;
      }
      if (ts.isVariableStatement(st) && usesZod(text)) {
        const exported = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? "export " : "";
        const parts = st.declarationList.declarations.map((d) => {
          const name = d.name.getText(sf);
          if (aliasOf.has(name)) return `${name}: BlocklabSchema<${aliasOf.get(name)}>`;
          const sym = checker.getSymbolAtLocation(d.name);
          const valueType = checker.getTypeOfSymbolAtLocation(sym, d);
          const outSym = valueType.getProperty("_output");
          if (!outSym) throw new Error(`${d.name.getText(sf)} 의 zod 출력 타입을 못 찾았어요`);
          const out = printType(checker, checker.getTypeOfSymbolAtLocation(outSym, d), st, sf);
          return `${name}: BlocklabSchema<${out}>`;
        });
        repl.push([st.getStart(sf), st.end, `${exported}declare const ${parts.join(", ")};`]);
        consts++;
      }
    }
    edits.set(file, repl);
    results.push({ file, aliases, consts });
  }
  for (const [file, repl] of edits) {
    let text = readFileSync(file, "utf8");
    for (const [start, end, value] of repl.sort((a, b) => b[0] - a[0])) text = text.slice(0, start) + value + text.slice(end);
    if (results.find((r) => r.file === file).consts > 0) text = SCHEMA_TYPE + text;
    if (/from\s+["']zod["']|import\(["']zod["']\)/.test(text) || usesZod(text)) {
      throw new Error(`${file} 에 zod 가 남았어요`);
    }
    writeFileSync(file, text);
  }
  return results;
}
