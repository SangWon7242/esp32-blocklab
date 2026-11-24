import { useGLTF } from "@react-three/drei";
import type { Scene3D } from "@/track/wiring3d";
import { BREADBOARD_GLB_URL, canUseGlbBreadboard } from "./breadboardGlb";
import { DEVKIT_GLB_URL } from "./devkitGlb";
import { EXPANSION_GLB_URL } from "./expansionGlb";

/*
 * 보드 실물 모델(GLB) 미리 받기. 모델은 페이지에 한 번만 받아 풀어 두고(drei 캐시) 화면마다 복제한다.
 * 보드를 바꿀 때 그 보드 모델을 아직 안 받았으면, 받는 동안 손으로 그린 보드가 나왔다가 실물 모델로 바뀌어
 * 한 장면에 보드가 두 번 바뀌어 보인다 — 바꾸기 전에(보드 고르기 칸에 마우스를 올리면) 미리 받는다.
 */

/** 그 장면(회로 보기)이 그리는 보드 · 브레드보드 실물 모델 주소 (withGlbDevkit · withGlbExpansion 을 거친 장면) */
export function boardModelUrls(scene: Scene3D): string[] {
  const out = new Set<string>();
  for (const b of scene.boards) {
    if (b.kind === "expansion" && b.model === "glb") out.add(EXPANSION_GLB_URL);
    if (b.kind === "devkit" && !b.seatedOn && b.model === "glb") out.add(DEVKIT_GLB_URL);
  }
  if (scene.breadboards.some((bb) => canUseGlbBreadboard(bb))) out.add(BREADBOARD_GLB_URL);
  return [...out];
}

let warmed = false;
/** 세 보드 모델(기본 보드 · 확장 보드 조립 · 브레드보드)을 미리 받아 풀어 둔다. 여러 번 불러도 한 번만 */
export function preloadBoardModels(): void {
  if (warmed) return;
  warmed = true;
  for (const url of [DEVKIT_GLB_URL, EXPANSION_GLB_URL, BREADBOARD_GLB_URL]) useGLTF.preload(url);
}
