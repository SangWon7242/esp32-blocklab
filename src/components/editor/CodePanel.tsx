import { useEffect, useRef } from "react";
import { EditorState, Compartment, StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from "@codemirror/language";
import { cn } from "@/lib/utils";
import { codeFontSize, CODE_FONT_FAMILY, CODE_FONT_SIZE_DEFAULT, CODE_FONT_SIZE_VAR, CODE_LINE_HEIGHT, useCodeFontSize } from "@/host/codeFontSize";
import { createEchoGuard } from "./echoGuard";

type Props = {
  value: string;
  readOnly: boolean;
  onChange: (code: string) => void;
  /** 1-based. null 이면 강조 없음 */
  errorLine?: number | null;
  /** 여러 줄 장식 (1-based). 문제 줄은 수준별 색, focus 는 지금 살펴보는 줄(파란 띠 + 왼쪽 선) */
  highlightLines?: LineHighlight[];
  /** 줄 번호를 누르면 그 줄 (1-based) */
  onLineClick?: (line: number) => void;
  className?: string;
};

export type HighlightKind = "error" | "warning" | "info" | "focus";
export type LineHighlight = { line: number; kind: HighlightKind };

const NO_HIGHLIGHTS: LineHighlight[] = [];

const setHighlights = StateEffect.define<LineHighlight[]>();
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setHighlights)) continue;
      const ranges = e.value
        .filter((h) => h.line >= 1 && h.line <= tr.state.doc.lines)
        .map((h) => Decoration.line({ class: `cm-lint-${h.kind}` }).range(tr.state.doc.line(h.line).from));
      deco = Decoration.set(ranges, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const setErrorLine = StateEffect.define<number | null>();
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setErrorLine)) continue;
      if (e.value == null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none;
      const line = tr.state.doc.line(e.value);
      deco = Decoration.set([Decoration.line({ class: "cm-error-line" }).range(line.from)]);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  // 글자 크기는 .blocklab 루트의 CSS 변수 (학생이 고른 값, src/host/codeFontSize.ts). 줄 번호 칸도 같은 크기·줄 높이를 따른다
  "&": { height: "100%", fontSize: `var(${CODE_FONT_SIZE_VAR}, ${CODE_FONT_SIZE_DEFAULT}px)` },
  // 글꼴은 D2Coding (index.css @font-face). 리가처는 끈다 (학생이 != 를 한 글자로 잘못 읽지 않게)
  ".cm-scroller": { fontFamily: CODE_FONT_FAMILY, lineHeight: String(CODE_LINE_HEIGHT), fontVariantLigatures: "none", fontFeatureSettings: '"liga" 0, "calt" 0' },
  ".cm-error-line": { backgroundColor: "rgba(239, 68, 68, 0.12)" },
  ".cm-lint-info": { backgroundColor: "rgba(148, 163, 184, 0.12)" },
  ".cm-lint-warning": { backgroundColor: "rgba(245, 158, 11, 0.12)" },
  ".cm-lint-error": { backgroundColor: "rgba(239, 68, 68, 0.12)" },
  // 강조 줄은 문제 줄 색보다 앞선다 (같은 줄에 둘 다 붙을 수 있다)
  ".cm-line.cm-lint-focus": { backgroundColor: "rgba(59, 130, 246, 0.15)", boxShadow: "inset 3px 0 0 #3b82f6" },
  ".cm-lineNumbers .cm-gutterElement": { cursor: "pointer" },
  "&.cm-focused": { outline: "none" },
});

/** 학생이 고른 글자 크기 (px). 기본 테마의 CSS 변수보다 앞선다 */
const fontSizeTheme = (px: number) => EditorView.theme({ "&": { fontSize: `${px}px` } });

export function CodePanel({ value, readOnly, onChange, errorLine = null, highlightLines = NO_HIGHLIGHTS, onLineClick, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyComp = useRef(new Compartment());
  const fontSizeComp = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onLineClickRef = useRef(onLineClick);
  onLineClickRef.current = onLineClick;
  /** 편집기가 보낸 글. 늦게 돌아온 메아리로 문서를 덮어 막 친 글자를 지우지 않게 한다 */
  const echoRef = useRef(createEchoGuard());
  /** value 를 문서에 넣는 동안은 onChange 를 다시 보내지 않는다 */
  const applyingRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const extensions: Extension[] = [
      lineNumbers({
        domEventHandlers: {
          mousedown(view, line, event) {
            onLineClickRef.current?.(view.state.doc.lineAt(line.from).number);
            // 줄 번호를 눌러도 포커스를 옮기지 않는다. 고칠 수 있는 편집기(코드 모드)면 키보드 포커스를 편집기에 둬
            // 다음 글자가 다른 곳으로 가지 않게 하고, 읽기 전용(블록 모드)이면 막 고른 블록의 선택·포커스를 지킨다
            event.preventDefault();
            if (!view.state.readOnly) view.focus();
            return true;
          },
        },
      }),
      highlightActiveLine(), history(), python(), indentUnit.of("    "),
      syntaxHighlighting(defaultHighlightStyle), keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      readOnlyComp.current.of(EditorState.readOnly.of(readOnly)),
      errorLineField, highlightField, theme, fontSizeComp.current.of(fontSizeTheme(codeFontSize())),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged || applyingRef.current) return;
        const text = u.state.doc.toString();
        echoRef.current.emitted(text);
        onChangeRef.current(text);
      }),
    ];
    const view = new EditorView({ state: EditorState.create({ doc: value, extensions }), parent: host });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // value 는 아래 effect 가 따로 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (readOnly) echoRef.current.reset();
    view.dispatch({ effects: readOnlyComp.current.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    // 편집기가 보냈던 글이 debounce 뒤 돌아온 것이면 문서가 이미 더 앞서 있으니 그대로 둔다
    if (current === value || echoRef.current.isEcho(value)) return;
    applyingRef.current = true;
    try {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    } finally {
      applyingRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine, value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setHighlights.of(highlightLines) });
  }, [highlightLines, value]);

  // 글자 크기를 바꾸면 크기 테마를 바꿔 끼운다. CSS 변수만 바뀌면 편집기가 줄 높이를 다시 재지 않아 줄 번호가 어긋난다
  // (테마가 바뀌면 CodeMirror 가 줄 높이·글자 폭을 다시 잰다)
  const fontSize = useCodeFontSize();
  useEffect(() => {
    viewRef.current?.dispatch({ effects: fontSizeComp.current.reconfigure(fontSizeTheme(fontSize)) });
  }, [fontSize]);

  // 새로 강조한 줄이 화면 밖이면 보이게 스크롤한다
  const firstFocus = highlightLines.find((h) => h.kind === "focus")?.line ?? null;
  useEffect(() => {
    const view = viewRef.current;
    if (!view || firstFocus == null || firstFocus > view.state.doc.lines) return;
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(firstFocus).from, { y: "nearest" }) });
  }, [firstFocus]);

  return <div ref={hostRef} className={cn("h-full w-full overflow-hidden", className)} data-testid="code-panel" />;
}
