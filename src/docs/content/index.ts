import type { BlockContent } from "../types";
import { coreContent } from "./core";
import { pinContent } from "./pin";
import { ledContent } from "./led";
import { switchContent } from "./switch";
import { sensorContent } from "./sensor";
import { soundContent } from "./sound";
import { motorContent } from "./motor";
import { displayContent } from "./display";
import { inputContent } from "./input";

/** 블록 종류 → 손으로 쓴 설명 (개념·예시·팁) */
export const CONTENT: Record<string, BlockContent> = {
  ...coreContent,
  ...pinContent,
  ...ledContent,
  ...switchContent,
  ...sensorContent,
  ...soundContent,
  ...motorContent,
  ...displayContent,
  ...inputContent,
};
