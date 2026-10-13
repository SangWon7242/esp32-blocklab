import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { findDoc } from "@/docs/catalog";
import { contentFile } from "@/track/files";
import { readSettings } from "../settings/settings";
import { EditorWorkbench } from "./EditorWorkbench";
import { SAMPLE_CODE } from "./sample";

export type { Panels } from "./EditorWorkbench";

/** 자유 코딩 화면 */
export function LabPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const exampleType = searchParams.get("example");
  // 예시는 처음 한 번만 싣는다: 실은 뒤(자식의 마운트 효과가 먼저 돈다) 주소에서 ?example= 을 뺀다.
  // 다시 읽기·뒤로 가기로 예시가 확인 없이 다시 실리지 않게. EditorWorkbench 는 initialExample·initialCode 를
  // 마운트할 때만 읽으므로 바뀐 props 로 다시 싣지 않는다
  useEffect(() => {
    if (!exampleType) return;
    setSearchParams((p) => {
      p.delete("example");
      return p;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
