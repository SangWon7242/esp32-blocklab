import { useEffect, useRef } from "react";
import { EditorState, Compartment, StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from "@codemirror/language";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  readOnly: boolean;
  onChange: (code: string) => void;
  /** 1-based. null 이면 강조 없음 */
  errorLine?: number | null;
  className?: string;
};

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
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: "1.6" },
  ".cm-error-line": { backgroundColor: "rgba(239, 68, 68, 0.12)" },
  "&.cm-focused": { outline: "none" },
});

export function CodePanel({ value, readOnly, onChange, errorLine = null, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyComp = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const extensions: Extension[] = [
      lineNumbers(), highlightActiveLine(), history(), python(), indentUnit.of("    "),
      syntaxHighlighting(defaultHighlightStyle), keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      readOnlyComp.current.of(EditorState.readOnly.of(readOnly)),
      errorLineField, theme,
      EditorView.updateListener.of((u) => { if (u.docChanged) onChangeRef.current(u.state.doc.toString()); }),
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
    view.dispatch({ effects: readOnlyComp.current.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine, value]);

  return <div ref={hostRef} className={cn("h-full w-full overflow-hidden", className)} data-testid="code-panel" />;
}
