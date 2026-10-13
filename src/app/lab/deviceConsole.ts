import type { WorkspaceJson } from "@/codegen";
import type { RunError } from "@/device";
import type { ConsoleEntry } from "@/lint";

/** 콘솔에 남길 보드 행 수 (오래된 것부터 버린다) */
export const MAX_DEVICE_ROWS = 500;

export type DeviceKind = "stdout" | "stderr" | "system";
export type DeviceRow = ConsoleEntry & { source: "device"; kind: DeviceKind };

/** 줄바꿈 없이 이어지는 출력은 이 길이에서 행을 끊는다 (한 행이 끝없이 커지지 않게) */
export const MAX_LINE_LENGTH = 4000;

/** 보드 행, 마지막 stdout 행이 아직 줄바꿈을 기다리는지(다음 조각을 이어 붙일지), 다음 행 id (React key, 늘어나기만 한다) */
export type DeviceConsole = { rows: DeviceRow[]; open: boolean; nextId: number };

export const EMPTY_DEVICE_CONSOLE: DeviceConsole = { rows: [], open: false, nextId: 0 };

/** id 없는 행 (id 는 콘솔에 붙일 때 단다) */
export function deviceRow(kind: DeviceKind, text: string): DeviceRow {
  return { source: "device", kind, level: kind === "stderr" ? "error" : "info", text };
}

const cap = (rows: DeviceRow[]) => (rows.length > MAX_DEVICE_ROWS ? rows.slice(rows.length - MAX_DEVICE_ROWS) : rows);

/**
 * 보드 출력을 콘솔 행으로. stdout 은 조각으로 오므로(줄 단위가 아님) 줄로 나누고, 줄바꿈 없이 끝난 꼬리는 열어 두었다가
 * 다음 조각과 이어 붙인다. \r 은 버린다 (\r\n 이 두 조각에 갈라져 와도 빈 행이 생기지 않게). system·stderr 는 통째로 한 행이고
 * 열린 줄을 닫는다.
 */
export function appendDeviceText(c: DeviceConsole, kind: DeviceKind, text: string): DeviceConsole {
  if (kind !== "stdout") return appendDeviceRow(c, deviceRow(kind, text));
  const parts = text.replace(/\r/g, "").split("\n");
  const tail = parts.pop()!; // 마지막 줄바꿈 뒤 (비었으면 줄이 끝났다)
  const rows = [...c.rows];
  let { open, nextId } = c;
  /** 열린 행에 이어 붙이고(넘치면 새 행), 끝에 열린 행을 남긴다 */
  const add = (piece: string) => {
    const last = rows.at(-1);
    if (!(open && last?.kind === "stdout")) {
      rows.push({ ...deviceRow("stdout", ""), id: nextId++ });
      open = true;
    }
    for (;;) {
      const cur = rows[rows.length - 1];
      const room = MAX_LINE_LENGTH - cur.text.length;
      if (piece.length <= room) {
        rows[rows.length - 1] = { ...cur, text: cur.text + piece };
        return;
      }
      rows[rows.length - 1] = { ...cur, text: cur.text + piece.slice(0, room) };
      piece = piece.slice(room);
      rows.push({ ...deviceRow("stdout", ""), id: nextId++ });
    }
  };
  for (const line of parts) {
    add(line);
    open = false;
  }
  if (tail) add(tail);
  return { rows: cap(rows), open, nextId };
}

/** 다 만든 행 하나를 붙인다 (열린 stdout 줄은 닫힌다) */
export function appendDeviceRow(c: DeviceConsole, row: DeviceRow): DeviceConsole {
  return { rows: cap([...c.rows, { ...row, id: c.nextId }]), open: false, nextId: c.nextId + 1 };
}

/** 보드 Traceback 한 행 (영어 그대로). 보드는 raw REPL 코드를 <stdin> 이라 부르지만 학생에게는 main.py */
export function tracebackRow(error: RunError): DeviceRow {
  const text = error.traceback.replace(/\r\n?/g, "\n").replaceAll('File "<stdin>"', 'File "main.py"').trimEnd();
  const row = deviceRow("stderr", text);
  return error.line === null ? row : { ...row, line: error.line };
}

type JsonBlock = { type?: string; inputs?: Record<string, { block?: JsonBlock; shadow?: JsonBlock }>; next?: { block?: JsonBlock } };

/** 작업판 JSON 에 쓰인 블록 종류 전부 (보드에 함께 올릴 라이브러리 고르기용) */
export function blockTypesIn(json: WorkspaceJson | null | undefined): string[] {
  const out = new Set<string>();
  const visit = (b: JsonBlock | undefined): void => {
    if (!b) return;
    if (b.type) out.add(b.type);
    for (const input of Object.values(b.inputs ?? {})) { visit(input.block); visit(input.shadow); }
    visit(b.next?.block);
  };
  for (const top of ((json?.blocks as { blocks?: JsonBlock[] } | undefined)?.blocks ?? [])) visit(top);
  return [...out];
}
