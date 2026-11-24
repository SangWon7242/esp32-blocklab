import { useEffect, useState } from "react";
import { loadScene3D, peekScene3D, scene3DKey, type Scene3D } from "@/track/wiring3d";

/*
 * 3D 장면 고르기 (챕터 작업대 · 배선 그림 3D 탭 · 크게 보기 창이 함께 쓴다).
 * 보드를 바꿔도 3D 보기(WebGL 캔버스)를 내리지 않는다:
 *   - 받아 둔 장면이면 같은 화면에서 바로 새 장면 (기다림 0)
 *   - 처음 보는 장면이면 받는 동안 pending — 보기는 그대로 두고 이전 장면은 가린 채 「준비하고 있어요」
 *   - 늦게 도착한 이전 보드의 장면은 버린다 (지금 이름표와 다르면 쓰지 않는다)
 * 캔버스를 다시 만들면 WebGL 준비 · 셰이더 컴파일 · 주변 빛(PMREM) · 텍스처 올리기를 매번 다시 해 멈칫한다.
 */

export type Loaded = { key: string; scene: Scene3D } | null;

/** 지금 보여 줄 장면: 받아 둔 것(cached)이 먼저, 아니면 지금 이름표로 받은 것만 (늦게 온 다른 이름표의 장면은 버린다) */
export function pickScene(key: string | undefined, cached: Scene3D | undefined, loaded: Loaded): Scene3D | null {
  if (key === undefined) return null;
  if (cached) return cached;
  return loaded && loaded.key === key ? loaded.scene : null;
}

type Options = {
  /** false 면 장면을 받지 않는다 (3D 를 안 보거나 못 보는 기기) */
  enabled: boolean;
  /** 처음 받을 때 브라우저가 한가해진 뒤에 올린다 (단계 목록이 먼저 그려지게) */
  idle?: boolean;
  /** 다른 보드의 그림 이름들: 한가할 때 장면을 미리 받아 둔다 (작은 JSON) */
  siblings?: (string | undefined)[];
};

function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 200);
  return () => window.clearTimeout(id);
}

/**
 * scene: 그릴 장면 (pending 이면 바로 전 장면 — 보기를 내리지 않으려고 넘긴다. 보기는 이것을 가린다)
 * pending: 새 장면을 받는 중
 */
export function useScene3D(chapterId: string, shown: string | undefined, { enabled, idle = false, siblings }: Options): { scene: Scene3D | null; pending: boolean } {
  const key = enabled ? scene3DKey(chapterId, shown) : undefined;
  const cached = key ? peekScene3D(chapterId, shown) : undefined;
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [held, setHeld] = useState<Scene3D | null>(null);
  const current = pickScene(key, cached, loaded);
  // 마지막으로 그린 장면을 쥐고 있는다 (새 장면을 받는 동안 보기를 내리지 않게)
  if (current && current !== held) setHeld(current);

  useEffect(() => {
    if (!key || cached) return;
    let alive = true;
    let cancelIdle: (() => void) | undefined;
    void loadScene3D(chapterId, shown)?.then((s) => {
      if (!alive) return;
      const put = () => { if (alive) setLoaded({ key, scene: s }); };
      if (idle) cancelIdle = whenIdle(put);
      else put();
    });
    return () => { alive = false; cancelIdle?.(); };
  }, [key, cached, chapterId, shown, idle]);

  // 다른 보드의 장면을 한가할 때 미리 (바꾸면 바로 그릴 수 있게)
  const sib = enabled ? (siblings ?? []).filter((s) => s !== shown && scene3DKey(chapterId, s)).join("|") : "";
  useEffect(() => {
    if (!sib || !current) return;
    return whenIdle(() => { for (const s of sib.split("|")) void loadScene3D(chapterId, s); });
  }, [sib, chapterId, current]);

  if (!key) return { scene: null, pending: false };
  return { scene: current ?? held, pending: !current && held !== null };
}
