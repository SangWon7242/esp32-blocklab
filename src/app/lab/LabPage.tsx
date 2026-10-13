import { useSearchParams } from "react-router";
import { findDoc } from "@/docs/catalog";
import { contentFile } from "@/track/files";
import { readSettings } from "../settings/settings";
import { EditorWorkbench } from "./EditorWorkbench";
import { SAMPLE_CODE } from "./sample";

export type { Panels } from "./EditorWorkbench";

/** 자유 코딩 화면 */
export function LabPage() {
  const [searchParams] = useSearchParams();
  const exampleType = searchParams.get("example");
  // ?example=<블록 종류> 이면 그 블록의 예시 프로그램으로 시작한다 (블록 사전에서 넘어올 때). ?code= 보다 먼저
  const example = exampleType ? findDoc(exampleType)?.example.code : undefined;
  return (
    <EditorWorkbench
      initialExample={example}
      // ?code=<챕터 id>/<파일> 이면 그 콘텐츠 코드로 시작한다 (트랙 편집기 단계에서 넘어올 때). 모르는 이름이면 예시 코드
      initialCode={example !== undefined ? SAMPLE_CODE : contentFile(searchParams.get("code")) ?? SAMPLE_CODE}
      // 설정의 "가짜 보드" 또는 ?device=fake
      fake={searchParams.get("device") === "fake" || readSettings().fakeBoard}
    />
  );
}
