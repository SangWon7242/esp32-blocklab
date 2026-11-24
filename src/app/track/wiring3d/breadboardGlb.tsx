import { useEffect, useMemo } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Scene3D } from "@/track/wiring3d";
import { BB_H, type Layout } from "./layout";
import { noOutline } from "./materials";

/*
 * 브레드보드 3D — 선생님이 다시 모델링한 400칸 브레드보드(public/blocklab/models/breadboard_400.glb, mm, 30열 · a~j · 양쪽 + − 줄).
 *
 * 배선도의 브레드보드는 챕터마다 크기가 다르다(5~30열, 한쪽 + − 줄 · 반쪽). 그래서 모델 꼭짓점마다 실물 mm 를 배선도 자리로 옮기고
 * 배선도 보드 테두리 밖은 잘라(테두리로 눌러) 그 챕터 크기만 보인다:
 *   - 가로: 1열 = 배선도 첫 열, 2.54mm = 배선도 구멍 간격(px) — 구멍이 배선도 구멍과 정확히 맞는다
 *   - 세로: a · e · f · j 줄과 + − 줄을 배선도 줄 자리에(배선도는 가운데 홈 · 줄 사이를 실물보다 좁게 그린다)
 *   - 높이: 윗면(8.5mm)이 지금 3D 의 BB_H 에 — 부품 · 선이 앉는 높이 그대로
 * + − 줄 색: 배선도는 양쪽 모두 바깥 줄이 + 다. 모델과 다르면 그쪽 빨강 · 파랑 선과 + − 표시를 바꿔 놓는다.
 * 배선도가 이 모델로 못 그리는 보드(+ − 줄만 · 구멍 간격이 다름 · 30열 넘음 · 줄 수가 10 · 5 가 아님)는 손으로 그린 브레드보드 그대로.
 */
export const BREADBOARD_GLB_URL = `${import.meta.env.BASE_URL ?? "/"}blocklab/models/breadboard_400.glb`;

type BB = Scene3D["breadboards"][number];

/** 모델 치수(mm): 1열 x · 줄 y(+ 가 위 = 먼 쪽) · + − 줄 y · 기판 끝 · 윗면 높이 */
const M = { rail1: -35.56, col1: -36.83, rowA: 13.97, rowE: 3.81, rowF: -3.81, rowJ: -13.97, railTOut: 23.85, railTIn: 21.31, railBIn: -21.31, railBOut: -23.85, top: 27.25, bot: -28.35, left: -41.25, right: 42.35, h: 8.5 } as const;
/** 모델에서 바깥 줄이 + 인지: 위는 바깥 + , 아래는 바깥 − */
const GLB_OUTER_PLUS = { top: true, bot: false } as const;

function shape(bb: BB) {
  const xs = [...new Set(bb.holes.map(([x]) => x))].sort((a, b) => a - b);
  const ys = [...new Set(bb.holes.map(([, y]) => y))].sort((a, b) => a - b);
  return { xs, ys, pitch: xs.length > 1 ? xs[1] - xs[0] : 0 };
}

/** 이 브레드보드를 모델로 그릴 수 있나 */
export function canUseGlbBreadboard(bb: BB): boolean {
  const { xs, ys, pitch } = shape(bb);
  return xs.length > 0 && xs.length <= 30 && (ys.length === 10 || ys.length === 5) && Math.abs(pitch - 16) < 0.01;
}

/** 오름차순 맞춤점(모델 아래로 → 배선도 y)으로 옮기고, 끝 밖은 끝에 붙인다(잘라 내기) */
function clampInterp(v: number, pts: [number, number][]) {
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [a0, b0] = pts[i - 1], [a1, b1] = pts[i];
    if (v <= a1) return b0 + ((v - a0) / (a1 - a0)) * (b1 - b0);
  }
  return pts[pts.length - 1][1];
}

export function BreadboardGlbBody({ bb, L, onPointerMove, onPointerOut }: {
  bb: BB; L: Layout;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void; onPointerOut: () => void;
}) {
  const gltf = useGLTF(BREADBOARD_GLB_URL);

  const meshes = useMemo(() => {
    const { xs, ys, pitch } = shape(bb);
    const k = pitch / 2.54; // px / mm
    const left = bb.x, right = bb.x + bb.w, top = bb.y, bottom = bb.y + bb.h;
    const rails = [...bb.rails].sort((a, b) => a.y - b.y);
    const railsTop = rails.filter((r) => r.y < ys[0]);
    const railsBot = rails.filter((r) => r.y > ys[ys.length - 1]);

    // 세로 맞춤점: 모델 y 를 뒤집은 값(-y, 위에서 아래로 커짐) → 배선도 y
    const pts: [number, number][] = [];
    if (railsTop.length === 2) pts.push([-M.top, top], [-M.railTOut, railsTop[0].y], [-M.railTIn, railsTop[1].y]);
    else pts.push([-M.rowA - (ys[0] - top) / k, top]);
    pts.push([-M.rowA, ys[0]], [-M.rowE, ys[4]]);
    if (ys.length === 10) {
      pts.push([-M.rowF, ys[5]], [-M.rowJ, ys[9]]);
      if (railsBot.length === 2) pts.push([-M.railBIn, railsBot[0].y], [-M.railBOut, railsBot[1].y], [-M.bot, bottom]);
      else pts.push([-M.rowJ + (bottom - ys[9]) / k, bottom]);
    } else {
      pts.push([-M.rowE + (bottom - ys[4]) / k, bottom]);
    }
    // + − 줄 구멍: 모델은 열과 반 칸(1.27mm) 어긋나 있고, 배선도는 그쪽 rail.xs 첫 구멍에 맞춘다 — 그 차이만큼 줄 띠의 구멍을 옮긴다
    const railDx = (side: typeof railsTop) => (side.length ? (side[0].xs[0] - xs[0]) / k - (M.rail1 - M.col1) : 0);
    const dxTop = railDx(railsTop), dxBot = railDx(railsBot);
    const mapX = (x: number) => Math.min(right, Math.max(left, xs[0] + (x - M.col1) * k));
    const hs = BB_H / M.h;

    // + − 줄 색 맞추기: 배선도 바깥 줄이 + 인데 모델과 다르면 그쪽 선 · 표시를 바깥 ↔ 안쪽으로 옮긴다
    const outerPlus = (side: typeof railsTop) => (side.length === 2 ? (side === railsTop ? side[0].plus : side[1].plus) : null);
    const swapTop = outerPlus(railsTop) !== null && outerPlus(railsTop) !== GLB_OUTER_PLUS.top;
    const swapBot = outerPlus(railsBot) !== null && outerPlus(railsBot) !== GLB_OUTER_PLUS.bot;
    const railShift = (name: string, cy: number): number => {
      const isTop = cy > 0;
      if (!(isTop ? swapTop : swapBot)) return 0;
      const red = /Red|^Plus/.test(name), blue = /Blue|^Minus/.test(name);
      if (!red && !blue) return 0;
      // 위는 빨강(+)이 바깥(큰 y), 아래는 빨강이 안쪽 — 어느 쪽이든 빨강을 6.1mm 내리고 파랑을 올리면 자리가 바뀐다
      const gap = 6.1; // 빨강 · 파랑 선 사이(mm)
      return red ? -gap : gap;
    };
    // 그 쪽 + − 줄이 배선도에 없으면 선 · 표시는 그리지 않는다
    const sideMissing = (cy: number) => (cy > 0 ? railsTop.length < 2 : railsBot.length < 2);

    const root = gltf.scene.children[0] ?? gltf.scene;
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const rel = new THREE.Matrix4();
    const out: THREE.Mesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      rel.multiplyMatrices(inv, m.matrixWorld);
      const g = m.geometry.clone();
      g.applyMatrix4(rel);
      g.computeBoundingBox();
      const bbox = g.boundingBox!;
      const cx = (bbox.min.x + bbox.max.x) / 2, cy = (bbox.min.y + bbox.max.y) / 2;
      const isBody = m.name === "Breadboard";
      if (!isBody) {
        // 줄 번호 · 글자 · + − 선과 표시: 배선도 보드 밖이면 버린다
        if (/^(Line_|Plus|Minus)/.test(m.name) && sideMissing(cy)) { g.dispose(); return; }
        const px = xs[0] + (cx - M.col1) * k;
        const py = clampInterp(-cy, pts);
        if (px < left + 2 || px > right - 2 || ((py <= top + 0.5 || py >= bottom - 0.5) && !/^Line_/.test(m.name))) { g.dispose(); return; }
      }
      const dy = isBody ? 0 : railShift(m.name, cy);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        const y = pos.getY(i) + dy, z = pos.getZ(i);
        // 기판의 + − 줄 띠(구멍 둘레)만 옮긴다 — 바깥 테두리 꼭짓점은 그대로
        if (isBody && Math.abs(y) > 17 && Math.abs(x) < 39.5) x += y > 0 ? dxTop : dxBot;
        pos.setXYZ(i, L.X(mapX(x)), Math.max(0, z) * hs + (isBody ? 0 : 0.05), L.Z(clampInterp(-y, pts)));
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingBox();
      g.computeBoundingSphere();
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => noOutline(mat));
      const mesh = new THREE.Mesh(g, mats.length === 1 ? mats[0] : mats);
      mesh.castShadow = isBody;
      mesh.receiveShadow = true;
      out.push(mesh);
    });
    return out;
  }, [gltf, bb, L]);
  useEffect(() => () => { for (const m of meshes) m.geometry.dispose(); }, [meshes]);

  return (
    <group onPointerMove={onPointerMove} onPointerOut={onPointerOut}>
      {meshes.map((m) => <primitive key={m.uuid} object={m} />)}
    </group>
  );
}
