import type { WorkspaceJson } from "@/codegen";
export type { WorkspaceJson };

export type BlockJson = {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockJson; shadow?: BlockJson }>;
  next?: { block: BlockJson };
  extraState?: unknown;
  icons?: { comment: { text: string; pinned: boolean; height: number; width: number } };
};

export type UnparsedItem = { line: number; text: string };

export type ParseResult =
  | { ok: true; json: WorkspaceJson; unparsed: UnparsedItem[] }
  | { ok: false; error: { line: number; message: string } };
