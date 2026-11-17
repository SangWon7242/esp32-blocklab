import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { CircuitBoard, Eye, LocateFixed, Minus, Plus, RotateCcw, RotateCw, X as XIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scene3D } from "@/track/wiring3d";
import { buildScene, type Anchor, type Built, type HoverInfo } from "./buildScene";
import { Schematic, schematicRows } from "./Schematic";

/** 키보드를 받는 뷰어: 여러 개가 떠 있으면(큰 창 등) 맨 나중에 뜬 것만 */
const keyOwners: symbol[] = [];

/*
 * 3D 배선 보기. 조립 설명서 그림처럼 비스듬히 내려다보는(등각) 시점에서
 *   끌기 · W A S D(앞 · 왼쪽 · 뒤 · 오른쪽) — 옮기기      Q / E · 돌리기 단추 — 90° 씩 돌리기      휠 · + − — 크게 · 작게      R — 처음으로
 * 키보드는 글을 쓰는 칸에 있지 않으면 어디서든 듣는다.
 * 올리기: 부품 · 핀 · 구멍 · 선에 마우스를 올리면 노랗게 빛나며 이름과 하는 일이 뜬다.
 * 누르기: LED 는 색, 저항은 값을 바꿔 볼 수 있는 카드가 열린다. 선은 그 선만 또렷해진다.
 * 설명 카드: 이번 배선에서 볼 것(핀 · LED · 저항)을 장면 둘레의 카드로 적고 점선으로 잇는다 (좁으면 작은 이름표로).
 * 「전기 켜 보기」: 전기가 도는 길을 빛 알갱이로, LED 는 차례로 켜지며 빛이 번진다.
 * WebGL 을 못 쓰는 기기에서는 onUnsupported 를 불러 그림으로 돌아가게 한다.
 */
const AZ0 = Math.PI / 5; // 처음 보는 방향 (보드가 앞, 브레드보드가 뒤)
const EL_TILT = (36 * Math.PI) / 180; // 비스듬히 내려다보는 높이
const EL_TOP = (89.5 * Math.PI) / 180;
const CARD_W = 184, CARD_H = 66;

const LED_COLORS = [["빨강", "#e03131"], ["노랑", "#f5b800"], ["초록", "#2f9e44"], ["파랑", "#1c7ed6"], ["흰색", "#f1f3f5"]] as const;
/** 저항 값마다 LED 밝기 (값이 클수록 전기가 적게 흘러 어둡다) */
const OHMS = [["220Ω", 1], ["1kΩ", 0.5], ["10kΩ", 0.14]] as const;

type Api = {
  rotate: (dir: 1 | -1) => void;
  zoom: (factor: number) => void;
  pan: (dx: number, dy: number) => void;
  top: (on: boolean) => void;
  reset: () => void;
  highlight: (color: string | null) => void;
  /** 목록 줄에 마우스를 올렸을 때: 그 색 선만 잠깐 또렷하게 (null 이면 고른 선으로 돌아간다) */
  preview: (color: string | null) => void;
  flow: (on: boolean) => void;
  ledColor: (index: number, color: string) => void;
  dim: (factor: number) => void;
  /** 설명 카드를 작은 이름표로 접을지 (부품 카드가 열려 있을 때) */
  compact: (on: boolean) => void;
  /** 고른 부품의 둥근 빛을 끈다 (부품 카드를 닫을 때) */
  deselect: () => void;
};

type Props = {
  scene: Scene3D;
  onUnsupported?: () => void;
  /** 큰 창: 넓으면 목록을 옆에 */
  large?: boolean;
  /** 보기 단추 줄 끝에 붙일 것 (크게 보기 등) */
  toolbar?: ReactNode;
  /** 작업대: 3D 가 부모 칸을 꽉 채우고(배경 없음) 연결·부품 목록은 infoContainer 로 보낸다 */
  stage?: boolean;
  /** 연결·부품 목록을 그릴 곳 (작업대의 옆 칸). stage 일 때만 쓴다 */
  infoContainer?: HTMLElement | null;
};

type PartCard = { label: string; text: string; control?: HoverInfo["control"] };

export function Wiring3DView({ scene, onUnsupported, large, toolbar, stage, infoContainer }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const calloutsRef = useRef<HTMLDivElement>(null);
  const partCardRef = useRef<HTMLDivElement>(null);
  const selPathRef = useRef<SVGPathElement>(null);
  const selHaloRef = useRef<SVGPathElement>(null);
  const selDotRef = useRef<SVGGElement>(null);
  const nodesRef = useRef(new Map<string, { dot: HTMLElement | null; card: HTMLElement | null; line: SVGLineElement | null }>());
  const apiRef = useRef<Api | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [flowing, setFlowing] = useState(false);
  const [topView, setTopView] = useState(false);
  const [info, setInfo] = useState<"rows" | "parts">("rows");
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [spots, setSpots] = useState<{ label: string; text: string }[]>([]);
  const [tip, setTip] = useState<{ label: string; text: string } | null>(null);
  const [part, setPart] = useState<PartCard | null>(null);
  const [ledColor, setLedColor] = useState<Record<number, string>>({});
  const [ohm, setOhm] = useState(0);
  const hasSchematic = schematicRows(scene).length > 0;
  const [schematic, setSchematic] = useState(Boolean(stage || large));

  /** 마우스 옆 설명 상자를 (x, y)(뷰어 칸 기준 px) 옆에 둔다. 칸 밖으로 나가지 않게 */
  const placeTip = (x: number, y: number) => {
    const node = tipRef.current, box = boxRef.current;
    if (!node || !box) return;
    const w = node.offsetWidth || 240, h = node.offsetHeight || 60;
    const left = Math.min(Math.max(8, x + 16), box.clientWidth - w - 8);
    const top = y + 18 + h > box.clientHeight - 8 ? y - h - 12 : y + 18;
    node.style.transform = `translate(${left}px, ${Math.max(8, top)}px)`;
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onUnsupported?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    // 짙은 남색 외곽선: 손으로 그린 설명서 그림체
    const effect = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.06, 0.13, 0.22], defaultAlpha: 1 });

    const world = new THREE.Scene();
    const built: Built = buildScene(scene);
    world.add(built.group);
    // 이름표가 너무 많으면(부품이 많은 작품) 핀 이름표는 빼고 부품만 — 핀은 마우스를 올리면 나온다
    const all = built.anchors.filter((a) => a.kind === "lesson");
    const lesson = all.length > 9 ? all.filter((a) => !a.pin) : all;
    setAnchors(lesson);
    setSpots(built.spots);
    setPart(null);
    setLedColor({});
    setOhm(0);
    world.add(new THREE.HemisphereLight("#ffffff", "#c9c2b4", 1.7));
    const sun = new THREE.DirectionalLight("#ffffff", 2.4);
    const r = Math.max(built.size.w, built.size.d);
    sun.position.set(-r * 0.5, r * 1.1, r * 0.35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 4 });
    world.add(sun);
    // 바닥 모눈: 장면과 함께 돌아가서 방향을 잃지 않는다
    const dark = document.documentElement.classList.contains("dark") || Boolean(mount.closest(".dark"));
    const cell = 24, cells = Math.ceil((r * 5) / cell / 10) * 10;
    const grid = new THREE.GridHelper(cell * cells, cells / 5, dark ? "#565b66" : "#cfc6b4", dark ? "#565b66" : "#cfc6b4");
    const fine = new THREE.GridHelper(cell * cells, cells, dark ? "#3d414a" : "#e2dbcc", dark ? "#3d414a" : "#e2dbcc");
    grid.position.y = -0.7;
    fine.position.y = -0.8;
    world.add(fine, grid);
    // 책상: 그림자만 받는 바닥
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.2 });
    floorMat.userData.outlineParameters = { visible: false };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r * 6, r * 6), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    world.add(floor);

    // 전기 흐름: 길마다 작은 빛 알갱이가 흐르는 방향으로 움직인다
    const dotGeo = new THREE.SphereGeometry(2.8, 12, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: "#ffe066", depthTest: false });
    dotMat.userData.outlineParameters = { visible: false };
    const dots = built.flows.map((curve) => {
      const length = curve.getLength();
      const n = Math.max(2, Math.round(length / 26));
      return { curve, length, meshes: Array.from({ length: n }, () => { const m = new THREE.Mesh(dotGeo, dotMat); m.visible = false; m.renderOrder = 5; world.add(m); return m; }) };
    });
    let flowOn = false, flowT = 0, flowClock = 0, dim = 1;
    /*
     * 차례대로 흐르기 (LED 회로의 길을 모두 찾은 장면): 한 번에 LED 하나씩,
     *   ① 보드의 핀에서 신호가 나간다 — 핀 둘레에 파란 고리가 퍼지고 보드의 파란 LED 가 켜진다
     *   ② 빛 알갱이가 핀 → 선 → 저항 → LED → GND 로 차례로 달려간다
     *   ③ 알갱이가 LED 에 닿는 순간 LED 가 켜진다
     * LED 가 하나면 켜짐 → 꺼짐을 되풀이하고, 여럿이면 차례로 넘어간다.
     */
    const SPEED = 420; // 알갱이가 1초에 가는 길이(px)
    const ON = 1.9, OFF = 0.7; // 켜져 있는 시간 · (LED 가 하나일 때) 꺼져 있는 시간
    const chains = built.chains.map((c) => {
      const lengths = c.curves.map((x) => x.getLength());
      return { ...c, lengths, total: lengths.reduce((a, b) => a + b, 0) };
    });
    const sequential = chains.length > 0;
    const pointOn = (chain: (typeof chains)[number], dist: number, out: THREE.Vector3) => {
      let rest = dist;
      for (let i = 0; i < chain.curves.length; i++) {
        if (rest <= chain.lengths[i] || i === chain.curves.length - 1) return chain.curves[i].getPointAt(Math.min(1, Math.max(0, rest / chain.lengths[i])), out);
        rest -= chain.lengths[i];
      }
      return out;
    };
    const train = sequential ? Array.from({ length: 64 }, () => { const m = new THREE.Mesh(dotGeo, dotMat); m.visible = false; m.renderOrder = 5; world.add(m); return m; }) : [];
    // 신호가 나가는 핀의 파란 고리
    const pulseMat = new THREE.MeshBasicMaterial({ color: "#1c7ed6", transparent: true, depthWrite: false, depthTest: false });
    pulseMat.userData.outlineParameters = { visible: false };
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 40), pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.renderOrder = 6;
    pulse.visible = false;
    world.add(pulse);
    /** 지금 차례의 회로와 그 차례가 시작된 뒤 지난 시간 (꺼져 있는 동안은 chain 이 없다) */
    const nowPlaying = () => {
      if (!sequential) return { chain: null, t: 0 };
      const span = chains.length === 1 ? ON + OFF : ON;
      const k = Math.floor(flowClock / span) % chains.length;
      const t = flowClock % span;
      return { chain: t < ON ? chains[k] : null, t };
    };
    /** LED 를 켠 모습 · 끈 모습으로 */
    const lightLeds = () => {
      const { chain, t } = nowPlaying();
      const n = built.leds.length;
      const phase = Math.floor(flowClock / 0.7);
      built.leds.forEach((led, i) => {
        const lit = flowOn && (sequential ? chain?.led === i && t * SPEED >= chain.toLed : n === 1 ? phase % 2 === 0 : phase % n === i);
        led.glass.emissiveIntensity = lit ? 0.35 + 1.4 * dim : 0.1;
        led.halo.visible = lit;
        led.halo.scale.setScalar(50 + 46 * dim);
        (led.halo.material as THREE.SpriteMaterial).opacity = 0.3 + 0.55 * dim;
      });
      if (built.boardLed) built.boardLed.emissiveIntensity = flowOn && sequential && chain ? 1.8 : 0.25;
    };
    /** 차례대로 흐르는 알갱이와 핀의 고리를 지금 시간에 맞게 놓는다 */
    const placeTrain = () => {
      const { chain, t } = nowPlaying();
      const head = chain ? t * SPEED * (0.35 + 0.65 * dim) : 0;
      train.forEach((m, i) => {
        // 알갱이는 26px 간격으로 줄지어 달리고, 맨 앞이 끝에 닿은 뒤에는 계속 이어서 흐른다
        const d = head - i * 26;
        m.visible = Boolean(flowOn && chain && d > 0 && (d <= chain.total || head > chain.total));
        if (m.visible && chain) pointOn(chain, d <= chain.total ? d : ((d % chain.total) + chain.total) % chain.total, m.position);
      });
      // 핀 고리: 차례가 시작되고 0.6초 동안 퍼지며 옅어진다
      const k = chain ? Math.min(1, t / 0.6) : 1;
      pulse.visible = Boolean(flowOn && chain && k < 1);
      if (pulse.visible && chain) {
        pulse.position.copy(chain.pin);
        pulse.scale.setScalar(8 + 30 * k);
        pulseMat.opacity = 0.9 * (1 - k);
      }
    };
    lightLeds();

    // 누른 부품: 둘레에 둥근 주황 빛(번짐 + 고리 둘)이 켜지고, 부품 카드와 점선으로 이어진다
    const selColor = "#f76707";
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const gg = glowCanvas.getContext("2d")!;
    const gr = gg.createRadialGradient(64, 64, 6, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,0.55)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.28)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    gg.fillStyle = gr;
    gg.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const flat = (geometry: THREE.BufferGeometry, material: THREE.MeshBasicMaterial) => {
      material.userData.outlineParameters = { visible: false };
      const m = new THREE.Mesh(geometry, material);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      return m;
    };
    const selGlow = flat(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: glowTex, color: selColor, transparent: true, depthWrite: false, depthTest: false }));
    const selRing = flat(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: selColor, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }));
    const selRing2 = flat(new THREE.RingGeometry(0.955, 1, 64), new THREE.MeshBasicMaterial({ color: selColor, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false }));
    const selGroup = new THREE.Group();
    selGroup.add(selGlow, selRing, selRing2);
    selGroup.visible = false;
    world.add(selGroup);
    let selected: { center: THREE.Vector3; radius: number } | null = null;
    let selClock = 0;
    const select = (next: typeof selected) => {
      selected = next;
      selClock = 0;
      selGroup.visible = next !== null;
      if (next) selGroup.position.copy(next.center);
      request();
    };

    // 마우스를 올린 것: 노란 덧칠 + 옆 설명
    const hlMat = new THREE.MeshBasicMaterial({ color: "#ffd43b", transparent: true, opacity: 0.55, depthTest: false });
    hlMat.userData.outlineParameters = { visible: false };
    const hlGroup = new THREE.Group();
    world.add(hlGroup);
    let hovered: HoverInfo | null = null;
    // 올린 부품은 살짝 들린다: 물체마다 지금 들린 높이(lifted)를 목표(올렸으면 LIFT, 아니면 0)로 부드럽게
    const LIFT = 7;
    const lifted = new Map<THREE.Object3D, { base: number; now: number; goal: number }>();
    const liftTo = (objects: THREE.Object3D[] | undefined, goal: number) => {
      for (const o of objects ?? []) {
        const cur = lifted.get(o) ?? { base: o.position.y, now: 0, goal: 0 };
        cur.goal = goal;
        lifted.set(o, cur);
      }
    };
    let pickedColor: string | null = null, previewColor: string | null = null;
    const keys = new Set<string>();
    let compact = false;

    // 등각(직교) 카메라: 멀리 있는 것도 같은 크기로 보여 줄 번호를 세기 쉽다
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -r * 10, r * 10);
    const target0 = new THREE.Vector3(0, 12, 0);
    const span = Math.hypot(built.size.w, built.size.d);
    let az = AZ0, azGoal = AZ0, el = EL_TILT, elGoal = EL_TILT;
    // 돌리기: 시간에 맞춘 가감속(천천히 출발 → 빠르게 → 천천히 멈춤). 도는 중에 또 누르면 그 자리에서 새 목표로 이어 간다
    const TURN_MS = 520;
    let turn: { az0: number; el0: number; t0: number } | null = null;
    const startTurn = () => { turn = { az0: az, el0: el, t0: performance.now() }; };
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target0);
    controls.enableRotate = false; // 돌리기는 90° 단추 · Q / E 로만 (늘 반듯한 시점)
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    const place = () => {
      const d = r * 3;
      camera.position.set(
        controls.target.x + d * Math.cos(el) * Math.sin(az),
        controls.target.y + d * Math.sin(el),
        controls.target.z + d * Math.cos(el) * Math.cos(az),
      );
      camera.lookAt(controls.target);
    };
    let fitZoom = 1;
    // 설명 카드가 양옆에 설 자리를 남기고 맞춘다
    const fit = (w: number, h: number) => { fitZoom = Math.min((w - (w >= 760 ? 2 * CARD_W : 0)) / (span * 0.9), h / (span * 0.72)); };

    /** 설명 카드 · 이름표 · 점 · 점선을 3D 자리에 맞춰 놓는다 */
    const v3 = new THREE.Vector3();
    const layout = (w: number, h: number) => {
      const pts = lesson.map((a) => {
        v3.copy(a.position).project(camera);
        return { a, x: ((v3.x + 1) / 2) * w, y: ((1 - v3.y) / 2) * h };
      });
      const cards = !compact && w >= 760 && h >= 420 && lesson.length <= 6;
      if (calloutsRef.current) calloutsRef.current.dataset.mode = cards ? "cards" : "pills";
      const spot = new Map<string, { x: number; y: number }>();
      if (cards) {
        // 왼쪽에 있는 것부터 절반은 왼쪽 기둥, 나머지는 오른쪽 기둥에 세운다 (한쪽으로 몰리지 않게)
        const byX = [...pts].sort((p, q) => p.x - q.x);
        const leftIds = new Set(byX.slice(0, Math.ceil(byX.length / 2)).map((p) => p.a.id));
        for (const side of ["left", "right"] as const) {
          const col = pts.filter((p) => leftIds.has(p.a.id) === (side === "left")).sort((p, q) => p.y - q.y);
          const top = side === "left" ? 52 : 12, bottom = h - (side === "right" ? 44 : 14);
          let y = top;
          const ys = col.map((p) => { const cy = Math.max(y, p.y - CARD_H / 2); y = cy + CARD_H + 10; return cy; });
          // 아래로 넘치면 위로 밀어 올린다
          let over = (ys[ys.length - 1] ?? 0) + CARD_H - bottom;
          for (let i = ys.length - 1; i >= 0 && over > 0; i--) {
            ys[i] -= over;
            if (i > 0) over = ys[i - 1] + CARD_H + 10 - ys[i];
            if (ys[i] < top) ys[i] = top;
          }
          col.forEach((p, i) => spot.set(p.a.id, { x: side === "left" ? 12 : w - CARD_W - 12, y: ys[i] }));
        }
      }
      // 고른 부품 ↔ 부품 카드: 카드 아래에서 내려와 꺾여 부품으로 가는 점선 + 부품 위의 점
      const card = partCardRef.current, path = selPathRef.current, dot = selDotRef.current;
      if (selected && card && path && dot) {
        v3.copy(selected.center).project(camera);
        const sx = ((v3.x + 1) / 2) * w, sy = ((1 - v3.y) / 2) * h;
        const cx = card.offsetLeft + card.offsetWidth * 0.82, cy = card.offsetTop + card.offsetHeight;
        const d = `M${cx} ${cy} L${cx} ${cy + 26} L${sx} ${sy}`;
        path.setAttribute("d", d);
        selHaloRef.current?.setAttribute("d", d);
        dot.setAttribute("transform", `translate(${sx} ${sy})`);
        path.style.display = dot.style.display = "";
        if (selHaloRef.current) selHaloRef.current.style.display = "";
      } else {
        if (path) path.style.display = "none";
        if (dot) dot.style.display = "none";
        if (selHaloRef.current) selHaloRef.current.style.display = "none";
      }
      for (const p of pts) {
        const node = nodesRef.current.get(p.a.id);
        if (!node) continue;
        if (node.dot) node.dot.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        const c = spot.get(p.a.id);
        if (c) {
          if (node.card) node.card.style.transform = `translate(${c.x}px, ${c.y}px)`;
          const ex = c.x < p.x ? c.x + CARD_W : c.x;
          node.line?.setAttribute("x1", String(p.x));
          node.line?.setAttribute("y1", String(p.y));
          node.line?.setAttribute("x2", String(ex));
          node.line?.setAttribute("y2", String(c.y + CARD_H / 2));
        } else {
          // 이름표: 점의 오른쪽 위에 붙이고 짧은 선으로 잇는다
          if (node.card) node.card.style.transform = `translate(${p.x + 14}px, ${p.y - 30}px)`;
          node.line?.setAttribute("x1", String(p.x));
          node.line?.setAttribute("y1", String(p.y));
          node.line?.setAttribute("x2", String(p.x + 16));
          node.line?.setAttribute("y2", String(p.y - 16));
        }
      }
    };

    let frame = 0;
    let last = performance.now();
    const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
    const draw = () => {
      frame = 0;
      // 돌리기 · 위에서 보기: 정해진 시간 동안 부드럽게
      let turning = false;
      if (turn) {
        const t = Math.min(1, (performance.now() - turn.t0) / TURN_MS);
        const k = ease(t);
        az = turn.az0 + (azGoal - turn.az0) * k;
        el = turn.el0 + (elGoal - turn.el0) * k;
        if (t >= 1) turn = null;
        else turning = true;
      } else {
        az = azGoal;
        el = elGoal;
      }
      // 도는 동안에는 설명 카드가 좌우로 옮겨 다니지 않게 잠시 숨긴다
      if (calloutsRef.current) calloutsRef.current.style.opacity = turning ? "0" : "1";
      // W A S D 를 누르고 있는 동안 화면을 그 방향으로 민다 (W 앞 · S 뒤 · A 왼쪽 · D 오른쪽)
      const kx = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0), ky = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (kx || ky) {
        // 화면에서 1초에 약 380px (기기 화면 주사율과 상관없이 같은 빠르기)
        camera.matrixWorld.extractBasis(right, up, fwd);
        const step = (380 * dt) / camera.zoom;
        controls.target.addScaledVector(right, kx * step).addScaledVector(up, ky * step);
      }
      // 장면이 화면 밖으로 사라지지 않게 보는 곳을 장면 둘레 안에 둔다
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -r * 0.7, r * 0.7);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z, -r * 0.7, r * 0.7);
      controls.target.y = THREE.MathUtils.clamp(controls.target.y, -r * 0.3, r * 0.5);
      place();
      const moving = controls.update() || kx !== 0 || ky !== 0;
      if (flowOn) {
        flowT += 66 * dt * (0.35 + 0.65 * dim); // 저항이 크면 알갱이도 천천히
        flowClock += dt;
        if (sequential) placeTrain();
        else for (const d of dots) d.meshes.forEach((m, i) => m.position.copy(d.curve.getPointAt(((flowT / d.length) + i / d.meshes.length) % 1)));
        lightLeds();
      }
      // 들림: 목표 높이로 다가간다 (다 내려온 것은 목록에서 뺀다)
      let lifting = false;
      for (const [o, l] of lifted) {
        l.now += (l.goal - l.now) * Math.min(1, dt * 16);
        if (Math.abs(l.goal - l.now) < 0.05) l.now = l.goal;
        else lifting = true;
        o.position.y = l.base + l.now;
        if (l.goal === 0 && l.now === 0) lifted.delete(o);
      }
      hlGroup.position.y = hovered?.lift?.length ? (lifted.get(hovered.lift[0])?.now ?? 0) : 0;
      if (selected) {
        // 안쪽 고리는 그대로, 바깥 고리는 천천히 퍼졌다 돌아온다
        selClock += dt;
        const pulse = 0.5 + 0.5 * Math.sin(selClock * 3.2);
        const rad = selected.radius;
        selGlow.scale.setScalar(rad * 1.7);
        selRing.scale.setScalar(rad);
        selRing2.scale.setScalar(rad * (1.22 + 0.1 * pulse));
        (selRing2.material as THREE.MeshBasicMaterial).opacity = 0.65 - 0.35 * pulse;
      }
      effect.render(world, camera);
      layout(mount.clientWidth, mount.clientHeight);
      if (moving || turning || flowOn || selected || lifting) request();
    };
    const request = () => { if (!frame) { if (!flowOn && !keys.size && !selected) last = performance.now(); frame = requestAnimationFrame(draw); } };
    controls.addEventListener("change", request);

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      const was = fitZoom;
      fit(w, h);
      camera.zoom = camera.zoom === 1 && was === 1 ? fitZoom : (camera.zoom / was) * fitZoom;
      controls.minZoom = fitZoom * 0.5;
      controls.maxZoom = fitZoom * 6;
      camera.updateProjectionMatrix();
      request();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const highlight = () => {
      const color = previewColor ?? hovered?.wire ?? pickedColor;
      for (const wire of built.wires) {
        const on = color === null || wire.color === color;
        for (const o of wire.objects) {
          const m = o.material as THREE.MeshToonMaterial;
          if (!m.transparent) continue;
          m.opacity = on ? 1 : 0.12;
          m.depthWrite = on;
          m.userData.outlineParameters = { visible: on };
        }
      }
      request();
    };

    const ray = new THREE.Raycaster();
    let lastPoint = new THREE.Vector3();
    const pick = (clientX: number, clientY: number): HoverInfo | null => {
      const box = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(built.hoverables, false)[0];
      if (hit) lastPoint = hit.point.clone();
      return hit ? ((hit.object.userData.resolve as (h: THREE.Intersection) => HoverInfo | null)(hit) ?? null) : null;
    };
    /** 그 부품의 한가운데(바닥 높이)와 둘레 크기 */
    const bounds = new THREE.Box3(), part3 = new THREE.Box3(), size3 = new THREE.Vector3();
    const selectionOf = (info: HoverInfo) => {
      if (!info.marks?.length) return { center: lastPoint.clone(), radius: 22 };
      bounds.makeEmpty();
      for (const m of info.marks) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        bounds.union(part3.copy(m.geometry.boundingBox!).applyMatrix4(m.matrix));
      }
      bounds.getSize(size3);
      const center = bounds.getCenter(new THREE.Vector3());
      center.y = bounds.min.y + 0.6;
      // 보드 판 · 브레드보드처럼 큰 것은 누른 자리에 작은 원으로
      const radius = Math.max(size3.x, size3.z) / 2 + 12;
      return radius > 90 ? { center: lastPoint.clone(), radius: 26 } : { center, radius: Math.max(16, radius) };
    };
    // 누르기: 선이면 그 선만 또렷하게, 부품이면 부품 카드 (끌어서 옮긴 것은 누른 것으로 치지 않는다)
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const hit = pick(e.clientX, e.clientY);
      if (hit?.wire) {
        setPicked((cur) => (cur === hit.wire ? null : hit.wire!));
        return;
      }
      setPicked(null);
      setPart(hit ? { label: hit.label, text: hit.text, control: hit.control } : null);
      select(hit ? selectionOf(hit) : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // 마우스 올림: 한 장면에 한 번만 찾는다
    let pointer: { x: number; y: number } | null = null, hoverFrame = 0;
    const none = new THREE.Matrix4().makeScale(0, 0, 0);
    const setHovered = (next: HoverInfo | null) => {
      if (next === hovered) return;
      const wireChanged = (next?.wire ?? null) !== (hovered?.wire ?? null);
      liftTo(hovered?.lift, 0);
      liftTo(next?.lift, LIFT);
      last = performance.now();
      hovered = next;
      hlGroup.clear();
      for (const m of next?.marks ?? []) {
        const mesh = new THREE.Mesh(m.geometry, hlMat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(m.matrix);
        mesh.renderOrder = 4;
        hlGroup.add(mesh);
      }
      renderer.domElement.style.cursor = next ? "pointer" : "";
      setTip(next ? { label: next.label, text: next.text } : null);
      if (wireChanged) highlight();
      request();
    };
    const findHover = () => {
      hoverFrame = 0;
      if (!pointer) return setHovered(null);
      const info = pick(pointer.x, pointer.y);
      // 같은 것 위에서 움직이는 동안은 다시 그리지 않는다
      const same = info && hovered && info.label === hovered.label && info.text === hovered.text && (info.marks?.[0]?.matrix ?? none).equals(hovered.marks?.[0]?.matrix ?? none);
      setHovered(same ? hovered : info);
      const box = renderer.domElement.getBoundingClientRect();
      placeTip(pointer.x - box.left, pointer.y - box.top);
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return; // 끄는 중에는 찾지 않는다
      pointer = { x: e.clientX, y: e.clientY };
      if (!hoverFrame) hoverFrame = requestAnimationFrame(findHover);
    };
    const onLeave = () => { pointer = null; if (!hoverFrame) hoverFrame = requestAnimationFrame(findHover); };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    // 키보드: 글 쓰는 칸이 아니면 어디서든 (Q · E 돌리기, W A S D 옮기기, + − 크기, R 처음으로)
    const me = Symbol("viewer");
    keyOwners.push(me);
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const active = () => keyOwners[keyOwners.length - 1] === me && mount.offsetParent !== null;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!active() || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if ("wasd".includes(k) && k.length === 1) { if (!keys.size) last = performance.now(); keys.add(k); request(); }
      else if (k === "q" && !e.repeat) apiRef.current?.rotate(-1);
      else if (k === "e" && !e.repeat) apiRef.current?.rotate(1);
      else if (k === "+" || k === "=") apiRef.current?.zoom(1.2);
      else if (k === "-") apiRef.current?.zoom(1 / 1.2);
      else if (k === "r") { apiRef.current?.reset(); setTopView(false); }
      else return;
      e.preventDefault();
    };
    const onKeyUp = (e: globalThis.KeyboardEvent) => { keys.delete(e.key.toLowerCase()); };
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    apiRef.current = {
      rotate: (dir) => { startTurn(); azGoal += (dir * Math.PI) / 2; request(); },
      zoom: (factor) => {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
        camera.updateProjectionMatrix();
        request();
      },
      pan: (dx, dy) => {
        // 화면 기준으로 옮긴다 (dx: 오른쪽 +, dy: 위 +)
        camera.matrixWorld.extractBasis(right, up, fwd);
        controls.target.addScaledVector(right, dx / camera.zoom).addScaledVector(up, dy / camera.zoom);
        request();
      },
      top: (on) => { startTurn(); elGoal = on ? EL_TOP : EL_TILT; if (on) azGoal = Math.round(azGoal / (Math.PI / 2)) * (Math.PI / 2); else azGoal += AZ0; request(); },
      reset: () => {
        controls.target.copy(target0);
        startTurn();
        azGoal = AZ0 + Math.round((az - AZ0) / (Math.PI * 2)) * Math.PI * 2;
        elGoal = EL_TILT;
        camera.zoom = fitZoom;
        camera.updateProjectionMatrix();
        request();
      },
      highlight: (color) => { pickedColor = color; highlight(); },
      preview: (color) => { previewColor = color; highlight(); },
      flow: (on) => {
        flowOn = on;
        flowClock = 0;
        if (sequential) placeTrain();
        else for (const d of dots) d.meshes.forEach((m) => (m.visible = on));
        lightLeds();
        request();
      },
      ledColor: (index, color) => {
        const led = built.leds[index];
        if (!led) return;
        led.glass.color.set(color);
        led.glass.emissive.set(color);
        (led.halo.material as THREE.SpriteMaterial).color.set(color);
        request();
      },
      dim: (factor) => { dim = factor; lightLeds(); request(); },
      compact: (on) => { compact = on; request(); },
      deselect: () => select(null),
    };

    return () => {
      apiRef.current = null;
      if (frame) cancelAnimationFrame(frame);
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      keyOwners.splice(keyOwners.indexOf(me), 1);
      controls.dispose();
      built.dispose();
      dotGeo.dispose();
      dotMat.dispose();
      pulse.geometry.dispose();
      pulseMat.dispose();
      hlMat.dispose();
      glowTex.dispose();
      for (const m of [selGlow, selRing, selRing2]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      grid.dispose();
      fine.dispose();
      floor.geometry.dispose();
      floorMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [scene, onUnsupported]);

  useEffect(() => { apiRef.current?.highlight(picked); }, [picked, scene]);
  useEffect(() => { apiRef.current?.flow(flowing); }, [flowing, scene]);
  useEffect(() => {
    apiRef.current?.compact(part !== null);
    if (!part) apiRef.current?.deselect();
    else apiRef.current?.pan(0, 0); // 카드가 그려진 뒤 점선을 다시 잇는다
  }, [part, scene]);
  // 이름표가 그려진 뒤 한 번 자리를 잡는다
  useEffect(() => { apiRef.current?.pan(0, 0); }, [anchors]);

  // 뷰어에 초점이 있을 때만 듣는 키 (다른 곳에서는 화면 넘기기 · 단추 누르기에 쓰이므로)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const api = apiRef.current;
    if (!api || e.metaKey || e.ctrlKey || e.altKey) return;
    const step = 40;
    const k = e.key;
    if (k === "ArrowLeft") api.pan(-step, 0);
    else if (k === "ArrowRight") api.pan(step, 0);
    else if (k === "ArrowUp") api.pan(0, step);
    else if (k === "ArrowDown") api.pan(0, -step);
    else if (k === " " && e.target === e.currentTarget) setFlowing((f) => !f);
    else if (k === "Escape" && part) setPart(null);
    else return;
    e.preventDefault();
  };
  /** 작은 이름표에 마우스를 올리면 그 부품이 하는 일이 옆에 뜬다 (설명 카드일 때는 카드에 이미 적혀 있다) */
  const cardTip = (a: Anchor) => (e: ReactMouseEvent<HTMLElement>) => {
    if (calloutsRef.current?.dataset.mode !== "pills") return;
    const box = boxRef.current?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label: a.label, text: a.text });
    if (box) requestAnimationFrame(() => placeTip(r.left - box.left + r.width / 2 - 16, r.bottom - box.top - 12));
  };
  const setNode = (id: string, key: "dot" | "card" | "line") => (el: HTMLElement | SVGLineElement | null) => {
    const cur = nodesRef.current.get(id) ?? { dot: null, card: null, line: null };
    nodesRef.current.set(id, { ...cur, [key]: el });
  };

  const tall = scene.boards.length > 0 && scene.breadboards.length > 0;
  const tool = "size-8";
  const ink = "border-[#0f2239]/80";
  const canvas = (
    <div
      ref={boxRef}
      className={cn("overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-ring/60", stage ? "absolute inset-0" : "relative w-full rounded-xl border bg-[#f8f4ec] dark:bg-[#24262b]", !stage && (large ? "h-[min(70dvh,42rem)]" : tall ? "aspect-[4/3] max-h-[70dvh]" : "aspect-[16/10] max-h-[70dvh]"))}
      data-testid={stage ? "wiring-3d" : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" role="img" aria-label={`3D 배선 보기: ${scene.rows.map((r) => `${r.part} → ${r.to}`).join(", ")}`} />

      {/* 설명 카드(넓을 때) · 이름표(좁을 때): 부품 위의 점에서 점선으로 이어진다 */}
      <div ref={calloutsRef} data-mode="pills" className="group/callouts pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-150" data-testid="wiring-3d-callouts">
        <svg className="absolute inset-0 size-full" aria-hidden>
          {anchors.map((a) => (
            <line key={a.id} ref={setNode(a.id, "line")} stroke={a.color} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 5" />
          ))}
        </svg>
        {anchors.map((a) => (
          <span key={`dot-${a.id}`} ref={setNode(a.id, "dot")} className="absolute top-0 left-0 size-3 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(15,34,57,0.85)] will-change-transform" style={{ background: a.color }} />
        ))}
        {anchors.map((a) => (
          <div
            key={a.id}
            ref={setNode(a.id, "card")}
            onMouseEnter={cardTip(a)}
            onMouseLeave={() => setTip(null)}
            className={cn(
              "pointer-events-auto absolute top-0 left-0 border bg-white text-[#0f2239] will-change-transform",
              ink,
              "group-data-[mode=cards]/callouts:w-[184px] group-data-[mode=cards]/callouts:rounded-xl group-data-[mode=cards]/callouts:px-3 group-data-[mode=cards]/callouts:py-2 group-data-[mode=cards]/callouts:shadow-[0_3px_0_rgba(15,34,57,0.18)]",
              "group-data-[mode=pills]/callouts:rounded-full group-data-[mode=pills]/callouts:px-2 group-data-[mode=pills]/callouts:py-0.5 group-data-[mode=pills]/callouts:shadow-[0_2px_0_rgba(15,34,57,0.3)]",
            )}
          >
            <p className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap group-data-[mode=cards]/callouts:text-[0.8rem]">
              <span className="size-2 shrink-0 rounded-full" style={{ background: a.color }} />
              {a.label}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[0.7rem] leading-snug break-keep text-[#5b6168] group-data-[mode=pills]/callouts:hidden">{a.text}</p>
          </div>
        ))}
      </div>

      {/* 고른 부품과 부품 카드를 잇는 점선 */}
      <svg className="pointer-events-none absolute inset-0 z-[5] size-full" aria-hidden>
        {/* 흰 받침 선: 어두운 보드 · 구멍 많은 브레드보드 위에서도 점선이 읽히게 */}
        <path ref={selHaloRef} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "none" }} />
        <path ref={selPathRef} fill="none" stroke="#f76707" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 6" style={{ display: "none" }} />
        <g ref={selDotRef} style={{ display: "none" }}>
          <circle r="9" fill="#ffffff" />
          <circle r="7" fill="#f76707" />
          <circle r="3.2" fill="#ffffff" />
        </g>
      </svg>

      {/* 마우스 옆 설명 */}
      <div
        ref={tipRef}
        role="tooltip"
        className={cn("pointer-events-none absolute top-0 left-0 z-20 max-w-64 rounded-xl border bg-white px-3 py-2 text-[#0f2239] shadow-[0_3px_0_rgba(15,34,57,0.25)] will-change-transform", ink, !tip && "hidden")}
        data-testid="wiring-3d-tip"
      >
        <p className="text-sm font-bold">{tip?.label}</p>
        <p className="mt-0.5 text-[0.8rem] leading-snug break-keep text-[#5b6168]">{tip?.text}</p>
      </div>

      <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant={flowing ? "default" : "outline"} className={cn("h-8", !flowing && "bg-background/95")} aria-pressed={flowing} data-testid="wiring-3d-flow" onClick={() => setFlowing((f) => !f)}>
          <Zap className="size-3.5" />{flowing ? "전기 끄기" : "전기 켜 보기"}
        </Button>
        {toolbar}
      </div>

      {/* 부품 카드: 3D 의 부품을 누르면 열린다. LED 는 색, 저항은 값을 바꿔 본다 */}
      {part && (
        <div ref={partCardRef} className={cn("absolute top-12 left-2 z-10 w-64 rounded-xl border bg-white p-3 text-[#0f2239] shadow-[0_4px_0_rgba(15,34,57,0.2)]", ink)} data-testid="wiring-3d-part">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm font-bold">{part.label}</p>
            <button type="button" className="-mt-1 -mr-1 rounded-md p-1 text-[#5b6168] outline-none hover:bg-neutral-100 focus-visible:ring-3 focus-visible:ring-ring/60" aria-label="부품 카드 닫기" onClick={() => setPart(null)}><XIcon className="size-4" /></button>
          </div>
          <p className="mt-1 text-[0.8rem] leading-snug break-keep text-[#5b6168]">{part.text}</p>
          {part.control?.type === "led" && (
            <div className="mt-3 border-t border-neutral-200 pt-2.5">
              <p className="text-xs font-semibold">색 바꿔 보기</p>
              <div className="mt-1.5 flex gap-2">
                {LED_COLORS.map(([name, color]) => {
                  const index = (part.control as { index: number }).index;
                  const on = (ledColor[index] ?? "") === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={name}
                      title={name}
                      aria-pressed={on}
                      onClick={() => { setLedColor((c) => ({ ...c, [index]: color })); apiRef.current?.ledColor(index, color); if (!flowing) setFlowing(true); }}
                      className={cn("size-7 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(15,34,57,0.5)] outline-none focus-visible:ring-3 focus-visible:ring-ring/60", on && "shadow-[0_0_0_2.5px_#0f2239]")}
                      style={{ background: color }}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {part.control?.type === "resistor" && (
            <div className="mt-3 border-t border-neutral-200 pt-2.5">
              <p className="text-xs font-semibold">다른 값으로 바꿔 보기</p>
              <div className="mt-1.5 flex gap-1.5">
                {OHMS.map(([name, factor], i) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={ohm === i}
                    onClick={() => { setOhm(i); apiRef.current?.dim(factor); if (!flowing) setFlowing(true); }}
                    className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/60", ohm === i ? "border-[#0f2239] bg-[#0f2239] text-white" : "border-neutral-300 hover:bg-neutral-100")}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[0.72rem] leading-snug break-keep text-[#5b6168]">값이 클수록 길이 좁아져 전기가 적게 흐르고, LED 가 어두워져요.</p>
            </div>
          )}
        </div>
      )}

      {/* 회로도: 전기가 지나가는 차례 */}
      {hasSchematic && schematic && (
        <div className={cn("absolute right-2 bottom-12 z-10 w-72 rounded-xl border bg-white/97 p-2 shadow-[0_3px_0_rgba(15,34,57,0.18)]", ink)} data-testid="wiring-3d-schematic">
          <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-bold text-[#0f2239]">
            <CircuitBoard className="size-3.5" />회로도
            <button type="button" className="ml-auto rounded p-0.5 text-[#5b6168] outline-none hover:bg-neutral-100 focus-visible:ring-3 focus-visible:ring-ring/60" aria-label="회로도 숨기기" onClick={() => setSchematic(false)}><XIcon className="size-3.5" /></button>
          </div>
          <Schematic scene={scene} />
        </div>
      )}

      {/* 보기 조절: 돌리기 · 크기 · 회로도 · 위에서 · 처음으로 */}
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border bg-background/95 p-1 shadow-sm">
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="왼쪽으로 돌리기 (Q)" title="왼쪽으로 돌리기 (Q)" data-testid="wiring-3d-rotate-left" onClick={() => apiRef.current?.rotate(-1)}><RotateCcw className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="오른쪽으로 돌리기 (E)" title="오른쪽으로 돌리기 (E)" onClick={() => apiRef.current?.rotate(1)}><RotateCw className="size-4" /></Button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="작게 (−)" title="작게 (−)" onClick={() => apiRef.current?.zoom(1 / 1.25)}><Minus className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="크게 (+)" title="크게 (+)" onClick={() => apiRef.current?.zoom(1.25)}><Plus className="size-4" /></Button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        {hasSchematic && (
          <Button type="button" size="icon" variant={schematic ? "secondary" : "ghost"} className={tool} aria-label="회로도" title="회로도" aria-pressed={schematic} data-testid="wiring-3d-schematic-toggle" onClick={() => setSchematic((v) => !v)}><CircuitBoard className="size-4" /></Button>
        )}
        <Button type="button" size="icon" variant={topView ? "secondary" : "ghost"} className={tool} aria-label="위에서 보기" title="위에서 보기" aria-pressed={topView} onClick={() => { const on = !topView; setTopView(on); apiRef.current?.top(on); }}><Eye className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="처음으로 (R)" title="처음으로 (R)" onClick={() => { apiRef.current?.reset(); setTopView(false); }}><LocateFixed className="size-4" /></Button>
      </div>

      <p className="pointer-events-none absolute bottom-2 left-2 hidden rounded-md bg-background/85 px-2 py-1 text-xs text-muted-foreground xl:block">
        끌거나 W A S D 로 움직여요 · Q / E 로 돌려요 · 휠로 크게
      </p>
    </div>
  );
  const infoPanel = (
      <div>
        <div className="mb-2 inline-flex rounded-lg bg-muted p-[3px]" role="tablist" aria-label="배선 정보">
          {([["rows", "연결"], ["parts", "부품"]] as const).map(([id, name]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={info === id}
              onClick={() => setInfo(id)}
              className={cn("rounded-md px-3 py-1 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50", info === id && "bg-background text-foreground shadow-xs")}
            >
              {name}
            </button>
          ))}
        </div>
        {info === "parts" ? (
          <ul className="grid gap-1.5" data-testid="wiring-3d-parts">
            {spots.map((sp) => (
              <li key={sp.label} className="rounded-lg border px-3 py-2 text-sm">
                <b className="font-semibold">{sp.label}</b>
                <p className="mt-0.5 leading-relaxed break-keep text-muted-foreground">{sp.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <>
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-sm font-semibold">{scene.title || "이렇게 꽂아요"}</p>
          {picked && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 text-muted-foreground" onClick={() => setPicked(null)}>
              <RotateCcw className="size-3.5" />모든 선 보기
            </Button>
          )}
        </div>
        <ul className="grid gap-1.5">
          {scene.rows.map((row, i) => {
            const on = row.colors.includes(picked ?? "");
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(on ? null : row.colors[0])}
                  onMouseEnter={() => apiRef.current?.preview(row.colors[0])}
                  onMouseLeave={() => apiRef.current?.preview(null)}
                  onFocus={() => apiRef.current?.preview(row.colors[0])}
                  onBlur={() => apiRef.current?.preview(null)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    on && "border-primary bg-primary/5",
                    picked && !on && "opacity-60",
                  )}
                >
                  <span className="flex shrink-0 flex-col gap-0.5 rounded bg-muted p-1">
                    {row.colors.map((c) => <span key={c} className="block h-1.5 w-6 rounded-full" style={{ background: c }} />)}
                  </span>
                  <span className="min-w-0"><b className="font-semibold">{row.part}</b> → {row.to}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-xs text-muted-foreground">줄을 누르면 그 선만 또렷하게 보여요.</p>
        </>
        )}
      </div>
  );
  if (stage) {
    return (
      <>
        {canvas}
        {infoContainer && createPortal(infoPanel, infoContainer)}
      </>
    );
  }
  return (
    <div className={cn("grid gap-3", large && "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start")} data-testid="wiring-3d">
      {canvas}
      {infoPanel}
    </div>
  );
}
