import type { Plugin, Rule } from "postcss";

/*
 * 블록랩 CSS 범위 플러그인 (PostCSS). Tailwind 가 만든 CSS 를 받아 모든 선택자를 `.blocklab` 아래로 옮긴다.
 * 라이브러리(dist-lib/style.css)가 호스트(허브) 화면의 다른 스타일을 건드리지 않게 하기 위한 것이며,
 * 체험판 빌드도 같은 플러그인을 써서 범위가 제대로 작동하는지 e2e 로 확인한다.
 *
 *   `*`, `.p-4`, `.dark\:x:is(.dark *)`   → `.blocklab *`, `.blocklab .p-4`, …
 *   `html`, `body`, `:root`, `:host`      → `.blocklab` (토큰·preflight 는 루트 div 가 받는다)
 *   `.dark`                               → `.dark .blocklab, .blocklab.dark` (다크 토큰)
 *   `.blockly…`, `.injectionDiv…`, `.lint-…` → 그대로 (Blockly 가 body 에 붙이는 요소까지 닿아야 한다)
 *
 * 루트(html·body)의 font-family 는 뺀다: 라이브러리는 호스트 글꼴을 상속한다 (`--font-sans` 는 --host-font-sans 로 바꿀 수 있다).
 * `@keyframes` 안·`@property`·`@layer` 선언은 건드리지 않는다.
 */

export type ScopeOptions = {
  /** 범위 선택자 (기본 `.blocklab`) */
  scope?: string;
  /** 이 파일에서 온 CSS 는 건드리지 않는다 (체험판 전용 demo.css 처럼 루트에 두어야 하는 것) */
  exclude?: (file: string | undefined) => boolean;
};

/** 선택자의 첫 복합 선택자가 이것이면 범위 선택자 자체로 바꾼다 */
const ROOTISH = new Set(["html", "body", ":root", ":host"]);
/** 전역에 남겨 두는 선택자 (Blockly 주입 요소, 검사 표시) */
const GLOBAL = [/\.blockly/, /\.injectionDiv/, /\.lint-/, /\.entryCategory/];
/** 루트에서 빼는 글꼴 선언 */
const ROOT_FONT_PROPS = new Set(["font-family", "font-feature-settings", "font-variation-settings"]);

/** 첫 복합 선택자의 끝 (괄호·대괄호·따옴표 밖의 결합자 위치). 없으면 selector.length */
export function firstCompoundEnd(selector: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && (c === " " || c === ">" || c === "+" || c === "~")) return i;
  }
  return selector.length;
}

/** 선택자 하나를 범위 아래로. 돌려주는 값이 여러 개일 수 있다 (.dark) */
export function scopeSelector(selector: string, scope = ".blocklab"): string[] {
  const s = selector.trim();
  if (s === "" || s.includes(scope)) return [s];
  if (GLOBAL.some((re) => re.test(s))) return [s];
  if (s === ".dark") return [`.dark ${scope}`, `${scope}.dark`];
  const end = firstCompoundEnd(s);
  const head = s.slice(0, end);
  if (ROOTISH.has(head)) return [`${scope}${s.slice(end)}`];
  return [`${scope} ${s}`];
}

function insideKeyframes(rule: Rule): boolean {
  let p = rule.parent;
  while (p && p.type !== "root") {
    if (p.type === "atrule" && /keyframes$/i.test((p as { name: string }).name)) return true;
    p = p.parent;
  }
  return false;
}

export function blocklabScope(options: ScopeOptions = {}): Plugin {
  const scope = options.scope ?? ".blocklab";
  return {
    postcssPlugin: "blocklab-scope",
    Once(root) {
      if (options.exclude?.(root.source?.input.file)) return;
      root.walkRules((rule) => {
        if (insideKeyframes(rule)) return;
        const before = rule.selectors;
        const hadRoot = before.some((s) => ROOTISH.has(s.trim().slice(0, firstCompoundEnd(s.trim()))));
        const after = [...new Set(before.flatMap((s) => scopeSelector(s, scope)))];
        rule.selectors = after;
        if (hadRoot) {
          rule.walkDecls((d) => {
            if (ROOT_FONT_PROPS.has(d.prop)) d.remove();
          });
          if (rule.nodes.length === 0) rule.remove();
        }
      });
    },
  };
}
blocklabScope.postcss = true;

export default blocklabScope;
