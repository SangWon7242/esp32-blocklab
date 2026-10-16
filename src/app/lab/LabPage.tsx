import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findDoc } from "@/docs/catalog";
import { useSettings } from "../settings/settings";
import { EditorWorkbench, type EditorWorkbenchHandle } from "./EditorWorkbench";
import { labStart, type LabInitialProgram } from "./labStart";
import { labDefaultTitle } from "./saveProject";
import { SaveProjectButton } from "./SaveProjectButton";

export type { Panels } from "./EditorWorkbench";

type Props = {
  /** 블록 사전의 "편집기에서 열어 보기": 그 블록의 예시 프로그램을 싣는다 (체험판은 ?example=) */
  exampleType?: string | null;
  /** 콘텐츠 코드 "<챕터 id>/<파일>" 로 시작한다 (트랙 편집기 단계의 "정답 코드 열기"; 체험판은 ?code=) */
  codeRef?: string | null;
  /** 예시를 실은 뒤 호스트가 주소에서 example 을 지울 수 있게 알린다 */
  onExampleLoaded?(): void;
  /**
   * 호스트가 불러온 작품 (lib-v1.0.3, 허브 ?project=). 처음 열 때 한 번만 싣고, exampleType·codeRef 보다 먼저다.
   * 같은 화면에서 다시 그려져도(값이 바뀌어도) 학생이 고친 것을 덮지 않는다 — 다른 작품을 열려면 호스트가 key 를 바꾼다
   */
  initialProgram?: LabInitialProgram | null;
};

/** 자유 코딩 화면 */
export function LabPage({ exampleType, codeRef, onExampleLoaded, initialProgram }: Props = {}) {
  const { fakeBoard } = useSettings();
  const workbench = useRef<EditorWorkbenchHandle>(null);
  const mounted = useRef(false);
  const onLoaded = useRef(onExampleLoaded);
  onLoaded.current = onExampleLoaded;
  // 예시 블록 종류: 처음 열릴 때는 initialExample 로 싣고(자식의 마운트 효과가 먼저 돈다), 이미 이 화면에 있는데
  // 값만 바뀌면(블록 사전 탭에서 링크를 누른 경우 등) 핸들로 싣는다. 실은 뒤에는 호스트에 알려 주소에서 ?example= 을 빼서
  // 다시 읽기·뒤로 가기로 예시가 확인 없이 다시 실리지 않게 한다
  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    if (!exampleType) return;
    if (!first) {
      const code = findDoc(exampleType)?.example.code;
      if (code) workbench.current?.openExample(code);
    }
    onLoaded.current?.();
  }, [exampleType]);
  // 마운트 때 한 번만 정한다 (EditorWorkbench 는 initialExample·initialCode·initialBlocks 를 마운트할 때만 본다).
  // 작품이 있으면 작품, 아니면 예시, 아니면 콘텐츠 코드(codeRef), 그것도 없거나 모르는 이름이면 시작 블록만 있는 빈 프로그램
  const [start] = useState(() =>
    labStart({ initialProgram, example: exampleType ? findDoc(exampleType)?.example.code : undefined, codeRef }),
  );
  // 저장 대화상자의 기본 제목: 불러온 작품의 제목, 없으면 "자유 코딩 <날짜>" (처음 연 때 정한다)
  const [defaultTitle] = useState(() => initialProgram?.title?.trim() || labDefaultTitle());
  const getProgram = useCallback(() => workbench.current?.getSaveProgram() ?? { code: "", blocksJson: null }, []);
  const actions = useMemo(() => <SaveProjectButton getProgram={getProgram} defaultTitle={defaultTitle} />, [getProgram, defaultTitle]);
  return (
    <EditorWorkbench
      ref={workbench}
      initialExample={start.initialExample}
      initialCode={start.initialCode}
      initialBlocks={start.initialBlocks}
      initialSource={start.initialSource}
      // 호스트 설정의 "가짜 보드" (체험판은 ?device=fake 도 섞어 넘긴다)
      fake={fakeBoard}
      // 「작품으로 저장」: 호스트 onSaveProject 가 없거나(체험판) 열람 모드면 단추가 그려지지 않는다
      actions={actions}
    />
  );
}
