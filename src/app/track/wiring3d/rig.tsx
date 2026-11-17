import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import type { Layout } from "./layout";
import { useViewerApi } from "./store";

/*
 * 카메라 · 조작 · 그리기.
 *   - 등각(직교) 카메라: 멀리 있는 것도 같은 크기라 줄 번호를 세기 쉽다
 *   - Q / E · 돌리기 단추: 90° 씩, 천천히 출발해 천천히 멈춘다 (0.52초)
 *   - W A S D: 누르고 있는 동안 화면 기준 앞 · 왼쪽 · 뒤 · 오른쪽으로 (1초에 화면 380px)
 *   - 끌기: 빈 곳 · 보드 · 브레드보드를 끌면 옮긴다 (부품을 끄는 조작이 먼저)
 *   - 휠 · 두 손가락: 마우스 자리를 향해 크게 · 작게
 *   - 짙은 남색 외곽선(OutlineEffect)으로 그린다
 */

const AZ0 = Math.PI / 5;
const EL_TILT = (36 * Math.PI) / 180;
const EL_TOP = (89.5 * Math.PI) / 180;
const TURN_MS = 520;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 키보드를 받는 뷰어: 여러 개가 떠 있으면(큰 창 등) 맨 나중에 뜬 것만 */
const keyOwners: symbol[] = [];

export function Rig({ L, cardsRoom }: { L: Layout; cardsRoom: boolean }) {
  const api = useViewerApi();
  const { gl, camera, size, invalidate } = useThree();
  const cam = camera as THREE.OrthographicCamera;
  const effect = useMemo(() => new OutlineEffect(gl, { defaultThickness: 0.0042, defaultColor: [0.06, 0.13, 0.22], defaultAlpha: 1 }), [gl]);
  const r = Math.max(L.size.w, L.size.d);
  // 처음 각도에서 장면 바닥 상자(높이 60)가 화면에 차지하는 가로 · 세로
  const proj = useMemo(() => {
    const ca = Math.cos(AZ0), sa = Math.sin(AZ0), se = Math.sin(EL_TILT), ce = Math.cos(EL_TILT);
    return { w: L.size.w * ca + L.size.d * sa, h: se * (L.size.w * sa + L.size.d * ca) + ce * 60 };
  }, [L.size.w, L.size.d]);
  const st = useRef({
    target: L.focus.clone(),
    /** 조립 순서에서 천천히 옮겨 갈 자리 */
    goal: null as THREE.Vector3 | null,
    az: AZ0, azGoal: AZ0, el: EL_TILT, elGoal: EL_TILT,
    turn: null as null | { az0: number; el0: number; t0: number },
    fit: 1,
    keys: new Set<string>(),
    last: performance.now(),
  });

  // 화면 크기에 맞춰 장면 전체가 들어오게 (설명 카드가 양옆에 설 자리를 남긴다)
  const fitted = useRef(false);
  useEffect(() => {
    if (size.width < 10 || size.height < 10) return;
    const s = st.current;
    const was = s.fit;
    // 설명 카드 기둥: 보통은 양옆에 하나씩, 현장 모형이 있으면 왼쪽에만 (모형이 오른쪽에 있다)
    const oneSide = Boolean(L.diorama);
    const room = cardsRoom && size.width >= 760 ? (oneSide ? 224 : 2 * 200) : 0;
    // 위 · 아래 단추 줄(약 110px)과 양옆 여백을 빼고 맞춘다.
    // 설명 카드 자리는 장면을 20% 넘게 줄여야 할 때는 다 비우지 않는다 (카드가 가장자리에 조금 겹쳐도 장면이 크게 보이는 편이 낫다)
    const fitH = (size.height - 110) / proj.h;
    const fitW = (size.width - 48) / proj.w;
    const fitRoom = (size.width - 48 - room) / proj.w;
    const best = Math.min(fitH, fitW);
    s.fit = Math.min(best, Math.max(fitRoom, best * 0.8));
    // 처음에는 장면 전체가 들어오게, 그 뒤로는 사람이 키운 만큼을 지킨다
    cam.zoom = fitted.current ? (cam.zoom / was) * s.fit : s.fit;
    fitted.current = true;
    cam.near = -r * 10;
    cam.far = r * 10;
    // 카드가 왼쪽에만 서면 장면을 그만큼 오른쪽으로 비켜 보인다
    if (oneSide && room) cam.setViewOffset(size.width, size.height, -room / 2, 0, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    invalidate();
  }, [size.width, size.height, proj, r, cam, cardsRoom, invalidate, L.diorama]);

  // 카메라 다루기: 보기 단추 · 키보드
  useEffect(() => {
    const s = st.current;
    const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
    const startTurn = () => { s.turn = { az0: s.az, el0: s.el, t0: performance.now() }; };
    const ctl = {
      rotate: (dir: 1 | -1) => { startTurn(); s.azGoal += (dir * Math.PI) / 2; invalidate(); },
      zoom: (f: number) => { cam.zoom = THREE.MathUtils.clamp(cam.zoom * f, s.fit * 0.5, s.fit * 6); cam.updateProjectionMatrix(); invalidate(); },
      focus: (at: THREE.Vector3 | null) => { s.goal = (at ?? L.focus).clone().setY(L.focus.y); invalidate(); },
      pan: (dx: number, dy: number) => {
        s.goal = null;
        cam.matrixWorld.extractBasis(right, up, fwd);
        s.target.addScaledVector(right, dx / cam.zoom).addScaledVector(up, dy / cam.zoom);
        invalidate();
      },
      top: (on: boolean) => {
        startTurn();
        s.elGoal = on ? EL_TOP : EL_TILT;
        s.azGoal = on ? Math.round(s.azGoal / (Math.PI / 2)) * (Math.PI / 2) : s.azGoal + AZ0;
        invalidate();
      },
      reset: () => {
        startTurn();
        s.goal = null;
        s.target.copy(L.focus);
        s.azGoal = AZ0 + Math.round((s.az - AZ0) / (Math.PI * 2)) * Math.PI * 2;
        s.elGoal = EL_TILT;
        cam.zoom = s.fit;
        cam.updateProjectionMatrix();
        invalidate();
      },
    };
    api.getState().set({ camera: ctl });

    const me = Symbol("viewer");
    keyOwners.push(me);
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const active = () => keyOwners[keyOwners.length - 1] === me && gl.domElement.offsetParent !== null;
    const down = (e: KeyboardEvent) => {
      if (!active() || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k.length === 1 && "wasd".includes(k)) { if (!s.keys.size) s.last = performance.now(); s.keys.add(k); invalidate(); }
      else if (k === "q" && !e.repeat) ctl.rotate(-1);
      else if (k === "e" && !e.repeat) ctl.rotate(1);
      else if (k === "+" || k === "=") ctl.zoom(1.2);
      else if (k === "-") ctl.zoom(1 / 1.2);
      else if (k === "r") { ctl.reset(); api.getState().set({ topView: false }); }
      else return;
      e.preventDefault();
    };
    const upKey = (e: KeyboardEvent) => s.keys.delete(e.key.toLowerCase());
    const blur = () => s.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", upKey);
    window.addEventListener("blur", blur);

    // 휠: 마우스 자리를 향해 크게 · 작게 (그 자리의 점이 손가락 아래에 남게)
    const el = gl.domElement;
    const ndc = (cx: number, cy: number) => {
      const b = el.getBoundingClientRect();
      return new THREE.Vector3(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1, 0);
    };
    const zoomAt = (f: number, cx: number, cy: number) => {
      const before = ndc(cx, cy).unproject(cam);
      cam.zoom = THREE.MathUtils.clamp(cam.zoom * f, s.fit * 0.5, s.fit * 6);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      const after = ndc(cx, cy).unproject(cam);
      s.goal = null;
      s.target.add(before.sub(after));
      invalidate();
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); };
    // 두 손가락: 벌리면 크게
    const touches = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const pdown = (e: PointerEvent) => { if (e.pointerType === "touch") touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
    const pmove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2) { pinch = 0; return; }
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d;
    };
    const pup = (e: PointerEvent) => { touches.delete(e.pointerId); pinch = 0; };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", pdown);
    el.addEventListener("pointermove", pmove);
    window.addEventListener("pointerup", pup);
    return () => {
      api.getState().set({ camera: null });
      keyOwners.splice(keyOwners.indexOf(me), 1);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", upKey);
      window.removeEventListener("blur", blur);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", pdown);
      el.removeEventListener("pointermove", pmove);
      window.removeEventListener("pointerup", pup);
    };
  }, [api, cam, gl, invalidate, L]);

  // 움직이고 그리기 (priority 1: R3F 대신 외곽선 효과로 그린다)
  const right = useMemo(() => new THREE.Vector3(), []), up = useMemo(() => new THREE.Vector3(), []), fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ scene }) => {
    const s = st.current;
    const now = performance.now();
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    let moving = false;
    if (s.turn) {
      const t = Math.min(1, (now - s.turn.t0) / TURN_MS);
      const k = ease(t);
      s.az = s.turn.az0 + (s.azGoal - s.turn.az0) * k;
      s.el = s.turn.el0 + (s.elGoal - s.turn.el0) * k;
      if (t >= 1) s.turn = null;
      else moving = true;
    } else { s.az = s.azGoal; s.el = s.elGoal; }
    const kx = (s.keys.has("d") ? 1 : 0) - (s.keys.has("a") ? 1 : 0), ky = (s.keys.has("w") ? 1 : 0) - (s.keys.has("s") ? 1 : 0);
    if (kx || ky) {
      s.goal = null;
      cam.matrixWorld.extractBasis(right, up, fwd);
      const step = (380 * dt) / cam.zoom;
      s.target.addScaledVector(right, kx * step).addScaledVector(up, ky * step);
      moving = true;
    }
    if (s.goal) {
      // 조립 순서: 지금 단계 쪽으로 부드럽게 (0.4초쯤)
      s.target.lerp(s.goal, 1 - Math.exp(-dt * 9));
      if (s.target.distanceTo(s.goal) < 0.5) { s.target.copy(s.goal); s.goal = null; }
      else moving = true;
    }
    s.target.x = THREE.MathUtils.clamp(s.target.x, L.focus.x - r * 0.7, L.focus.x + r * 0.7);
    s.target.z = THREE.MathUtils.clamp(s.target.z, L.focus.z - r * 0.7, L.focus.z + r * 0.7);
    const d = r * 3;
    cam.position.set(s.target.x + d * Math.cos(s.el) * Math.sin(s.az), s.target.y + d * Math.sin(s.el), s.target.z + d * Math.cos(s.el) * Math.cos(s.az));
    cam.lookAt(s.target);
    cam.updateMatrixWorld();
    // 도는 동안에는 설명 카드가 좌우로 옮겨 다니지 않게 잠시 숨긴다
    const c = api.getState().dom.callouts;
    if (c) c.style.opacity = s.turn || api.getState().step !== null ? "0" : "1";
    effect.render(scene, cam);
    if (moving) invalidate();
  }, 1);

  return null;
}

/** 빈 곳 · 보드 · 브레드보드를 끌면 화면을 옮긴다 (부품 조작이 먼저 멈춘 끌기는 오지 않는다) */
export function PanFloor({ r }: { r: number }) {
  const api = useViewerApi();
  const dragging = useRef(false);
  const mat = useMemo(() => {
    const m = new THREE.ShadowMaterial({ opacity: 0.18 });
    m.userData.outlineParameters = { visible: false };
    return m;
  }, []);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
      material={mat}
      receiveShadow
      onPointerDown={(e) => {
        if (api.getState().dragging || e.button !== 0) return;
        dragging.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current || !(e.buttons & 1) || e.pointerType === "touch" && e.isPrimary === false) return;
        api.getState().camera?.pan(-e.nativeEvent.movementX, e.nativeEvent.movementY);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }}
      onClick={(e) => {
        if (e.delta > 4) return;
        api.getState().set({ selected: null, picked: null });
        api.getState().invalidate();
      }}
    >
      <planeGeometry args={[r * 8, r * 8]} />
    </mesh>
  );
}
