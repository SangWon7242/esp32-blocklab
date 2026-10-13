import type { BlockContent } from "../types";
import { coreContent } from "./core";
import { pinContent } from "./pin";
import { ledContent } from "./led";
import { switchContent } from "./switch";

/** 블록 종류 → 손으로 쓴 설명 (개념·예시·팁) */
export const CONTENT: Record<string, BlockContent> = {
  ...coreContent,
  ...pinContent,
  ...ledContent,
  ...switchContent,
};
