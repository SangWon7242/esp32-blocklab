import * as THREE from "three";
import type { Part3D, Pt, Scene3D } from "@/track/wiring3d";

/**
 * 배선 장면(px 좌표)을 three.js 물체로 만든다. 1px = 1 단위, 그림의 x → X, y → Z, 높이는 Y.
 * 그림체: 단계가 또렷한 색(toon) + 검은 외곽선(뷰어의 OutlineEffect) — 손으로 그린 조립 설명서처럼.
 * 반환: 장면에 넣을 묶음(group), 선마다의 물체(강조용), 이름표 자리(anchors), 전기가 지나는 길(flows).
 */
export type Anchor = {
  id: string;
  label: string;
  /** 눌렀을 때 보여 줄 한두 문장 */
  text: string;
  /** 점 색 (핀은 노랑, 부품은 그 부품 색) */
  color: string;
  /** lesson: 이번 배선에서 볼 것(설명 카드로), board: 보드 알아보기(마우스를 올리면 나온다) */
  kind: "lesson" | "board";
  /** 보드 핀의 이름표 (부품이 많은 장면에서는 숨기고 마우스를 올리면 나오게 한다) */
  pin?: boolean;
  position: THREE.Vector3;
};

/** 마우스를 올린 곳의 설명. marks: 노랗게 덧칠할 모양들, wire: 그 선의 색(같은 색 선만 또렷하게) */
export type HoverInfo = {
  label: string;
  text: string;
  marks?: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[];
  /** 마우스를 올리면 함께 살짝 들어 올릴 물체들 (부품 하나를 이루는 조각들) */
  lift?: THREE.Object3D[];
  wire?: string;
  /** 눌렀을 때 바꿔 볼 수 있는 것: LED 는 색, 저항은 값 */
  control?: { type: "led"; index: number } | { type: "resistor" };
};

/** LED 하나: 유리 재질과 빛 번짐 */
export type LedPart = { glass: THREE.MeshToonMaterial; halo: THREE.Sprite; shine: THREE.Material };

export type Built = {
  group: THREE.Group;
  /** 마우스를 올릴 수 있는 물체들. userData.resolve(hit) 가 HoverInfo 를 준다 */
  hoverables: THREE.Object3D[];
  /** 선 하나 = 관 + 양 끝 머리. color 는 연결 표의 색과 같다 */
  wires: { color: string; objects: THREE.Mesh[] }[];
  size: { w: number; d: number };
  /** 전기가 지나가는 길 (흐르는 방향 순서): 선·저항·LED 다리 */
  flows: THREE.Curve<THREE.Vector3>[];
  /** LED 들 (전기가 흐르면 밝게 · 색을 바꿔 볼 수 있다) */
  leds: LedPart[];
  /**
   * LED 회로마다 전기가 지나가는 길을 차례대로: 보드 핀 → 선 → 저항 → LED → (점퍼) → GND.
   * pin: 출발하는 핀의 자리, toLed: 출발해서 LED 까지의 길이. 길을 다 찾지 못한 장면은 비어 있다
   */
  chains: { led: number; curves: THREE.Curve<THREE.Vector3>[]; pin: THREE.Vector3; toLed: number }[];
  /** 보드에 붙은 파란 LED (신호를 보낼 때 함께 깜빡인다). 없는 보드도 있다 */
  boardLed?: THREE.MeshToonMaterial;
  /** 화면 위 이름표 (HTML 로 그린다) */
  anchors: Anchor[];
  /** 부품 설명 목록 (이름이 겹치지 않게) */
  spots: { label: string; text: string }[];
  dispose: () => void;
};

const BB_H = 15; // 브레드보드 두께 (두툼한 흰 판)
const PCB_H = 6; // 보드 판 두께
const HEADER_H = 11; // 핀 소켓(Plus) 높이
const PIN_LEN = 21; // DevKit 금색 핀 길이 (받침 위로 길게 선다)
const PIN_SEAT = 8; // DevKit: 선 머리가 핀에 씌워져 내려앉는 높이
const DEVKIT_F = 1.7; // DevKit 보드의 세로(핀 두 줄 사이)를 실제 비율로 늘리는 배수

const inRect = (p: Pt, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** 외곽선을 그리지 않을 재질 (구멍·글자 판·빛 알갱이처럼 작거나 납작한 것) */
const noOutline = <M extends THREE.Material>(m: M): M => {
  m.userData.outlineParameters = { visible: false };
  return m;
};

const TEXT = {
  led: "전기가 긴 다리(+)로 들어가 짧은 다리(−)로 나올 때 빛나요. 거꾸로 꽂으면 켜지지 않아요.",
  resistor: "전기가 너무 많이 흐르지 않게 길을 좁혀 줘요. 방향이 없어서 어느 쪽으로 꽂아도 돼요.",
  pin: "코드가 이 핀을 켜면(HIGH) 전기가 나오고, 끄면(LOW) 멈춰요.",
  gpio: "켜고 끄거나(출력) 값을 읽을 수 있는(입력) 핀이에요.",
  inputOnly: "입력만 되는 핀이에요. 센서 값을 읽을 때 써요.",
  v5: "5V 전기가 나오는 핀이에요. 모터나 초음파 센서처럼 힘이 필요한 부품에 써요.",
  v33: "3.3V 전기가 나오는 핀이에요. 센서 대부분은 여기서 전기를 받아요.",
  reset: "보드를 처음부터 다시 시작하게 하는 핀이에요.",
  i2c: "화면(OLED)이나 카드 읽개 같은 부품과 이야기하는 핀이에요.",
  serial: "컴퓨터와 이야기할 때 쓰는 핀이라 보통 비워 둬요.",
  board: "ESP32 를 쓰기 쉽게 올려 둔 판이에요. 가장자리의 핀에 선을 꽂아 부품과 이어요.",
  usbChip: "컴퓨터와 보드가 서로 말을 알아듣게 통역해 주는 칩이에요.",
  regulator: "USB 로 들어온 5V 를 보드가 쓰는 3.3V 로 낮춰 주는 부품이에요.",
  powerLed: "보드에 전기가 들어오면 켜지는 빨간 불이에요.",
  hole: "이 다섯 칸은 속에서 서로 이어져 있어요. 같은 줄에 꽂은 부품끼리 전기가 통해요.",
  railPlus: "옆으로 길게 이어진 + 줄이에요. 전원(3V3 · 5V)을 여러 부품이 나눠 쓸 때 써요.",
  railMinus: "옆으로 길게 이어진 − 줄이에요. GND 를 여러 부품이 나눠 쓸 때 써요.",
  wire: "부품과 핀을 이어 전기가 지나가게 하는 선이에요.",
  tact: "누르고 있는 동안만 전기가 통하는 스위치예요. 다리 네 개 중 대각선에 있는 둘을 써요.",
  buzzer: "전기가 빠르게 켜졌다 꺼지면 떨면서 소리를 내요. + 표시가 있는 다리가 핀 쪽이에요.",
  pot: "손잡이를 돌리면 가운데 다리로 나오는 전기의 세기가 바뀌어요.",
  photo: "빛을 받으면 전기가 잘 통하고 어두우면 덜 통해요. 그래서 밝기를 숫자로 읽을 수 있어요.",
  tilt: "안에 작은 쇠구슬이 있어요. 기울이면 구슬이 굴러 다리 사이가 끊겨요.",
  rgb: "빨강 · 초록 · 파랑 LED 셋이 한 몸에 들어 있어요. 셋의 밝기를 섞어 여러 색을 만들어요.",
  irrx: "리모컨이 쏘는 눈에 안 보이는 빛을 받아요.",
  dip: "핀 세 개로 불 여덟 개를 켜고 끌 수 있게 도와주는 칩이에요. 반달 홈으로 방향을 맞춰요.",
  servo: "정해 준 각도만큼만 도는 모터예요. 갈색은 GND, 빨강은 5V, 주황은 신호예요.",
  gnd: "전기가 한 바퀴 돌아 다시 보드로 돌아가는 곳이에요.",
  module: "보드의 두뇌예요. 우리가 쓴 코드를 읽고 핀을 켜고 꺼요. WiFi 안테나도 이 안에 들어 있어요.",
  usb: "컴퓨터에서 전기와 코드를 받는 문이에요. 배선을 바꿀 때는 먼저 빼 둬요.",
  breadboard: "같은 번호 줄의 다섯 칸은 속에서 서로 이어져 있어요. + − 줄은 옆으로 길게 이어져 있어요.",
  bootLed: "보드에 붙어 있는 작은 LED 예요. 2번 핀을 켜면 함께 켜져요.",
  button: "EN 은 보드를 처음부터 다시 시작하고, BOOT 는 새 프로그램을 받을 때 써요.",
};

const MODULE: Record<string, { name: string; text: string }> = {
  ultrasonic: { name: "초음파 센서", text: "귀에 안 들리는 소리를 쏘고 메아리가 돌아오는 시간을 재서 거리를 알아내요." },
  oled: { name: "OLED 화면", text: "작은 점들이 빛나서 글자와 그림을 보여 주는 화면이에요." },
  rfid: { name: "RFID 모듈", text: "카드를 가까이 대면 카드마다 다른 번호를 읽어요." },
  dht: { name: "온습도 센서", text: "주변의 온도와 습도를 재요." },
  pir: { name: "PIR 센서", text: "사람 몸에서 나오는 열의 움직임을 느껴요." },
  sound: { name: "소리 센서", text: "소리가 크면 값이 커지는 작은 마이크예요." },
  flame: { name: "불꽃 센서", text: "불꽃에서 나오는 빛을 느껴요." },
  ir: { name: "IR 수신 모듈", text: "리모컨이 쏘는 눈에 안 보이는 빛을 받아요." },
  lm35: { name: "온도 센서", text: "온도를 전기의 세기로 바꿔 알려 줘요." },
  joystick: { name: "조이스틱", text: "막대를 기울인 방향과 정도를 숫자 둘로 알려 주고, 누르면 버튼이 돼요." },
  keypad: { name: "4×4 키패드", text: "눌린 키가 어느 줄, 어느 칸인지로 숫자를 알아내요." },
  fan: { name: "팬 모듈", text: "작은 모터가 날개를 돌려 바람을 만들어요. 힘이 필요해서 5V 를 써요." },
  generic: { name: "모듈", text: "보드와 선으로 이어 쓰는 부품이에요." },
};

export function buildScene(scene: Scene3D): Built {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o; };

  // 밝음 3단계: 그림자 · 중간 · 빛 받는 면
  const ramp = track(new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat));
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const mat = (color: string, extra: THREE.MeshToonMaterialParameters = {}) =>
    track(new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra }));

  // 그림의 실제 범위(보드·브레드보드) 가운데를 원점으로
  // 책상에 놓인 모듈 · 서보까지 넣어야 장면이 화면 밖으로 잘리지 않는다
  const rects: { x: number; y: number; w: number; h: number }[] = [
    ...scene.boards,
    ...scene.breadboards,
    ...scene.parts.flatMap((p) => (p.type === "module" ? [{ x: p.x, y: p.y - 14, w: p.w, h: p.h + 28 }] : p.type === "servo" ? [{ x: p.x - 46, y: p.y, w: 158, h: 54 }] : [])),
  ];
  const minX = Math.min(...rects.map((r) => r.x)), maxX = Math.max(...rects.map((r) => r.x + r.w));
  /*
   * 실제 비율: 배선도 그림의 DevKit 은 핀 두 줄이 가까워 길쭉하지만, 실물은 가로 51mm · 세로 28mm 이다.
   * 그래서 3D 에서는 보드의 세로(그림의 y)만 DEVKIT_F 배로 늘리고, 보드보다 아래에 있는 것은 늘어난 만큼 내려 보낸다.
   * 보드 옆에 나란히 놓인 모듈 · 서보는 한 덩어리로 움직여야 하므로 가운데가 옮겨지는 만큼 통째로 옮긴다(owners).
   */
  const dk = scene.boards.find((b) => b.kind === "devkit");
  const F = dk ? DEVKIT_F : 1;
  const stretch = (y: number) => (!dk || y <= dk.y ? y : y >= dk.y + dk.h ? y + (F - 1) * dk.h : dk.y + (y - dk.y) * F);
  const unstretch = (y: number) => (!dk || y <= dk.y ? y : y >= dk.y + dk.h * F ? y - (F - 1) * dk.h : dk.y + (y - dk.y) / F);
  const owners = scene.parts.flatMap((p) => {
    if (p.type === "module") return [{ x: p.x - 2, y: p.y - 18, w: p.w + 4, h: p.h + 36, dz: stretch(p.y + p.h / 2) - (p.y + p.h / 2) }];
    if (p.type === "servo") {
      const dz = stretch(p.y + 22) - (p.y + 22);
      return [{ x: p.x - 8, y: p.y - 4, w: 84, h: 52, dz }, ...(p.plugBox ? [{ x: p.plugBox.x - 2, y: p.plugBox.y - 2, w: p.plugBox.w + 4, h: p.plugBox.h + 4, dz }] : [])];
    }
    return [];
  });
  const minY = Math.min(...rects.map((r) => stretch(r.y))), maxY = Math.max(...rects.map((r) => stretch(r.y + r.h)));
  const cx = (minX + maxX) / 2, cz = (minY + maxY) / 2;
  const X = (x: number) => x - cx, Z = (y: number) => stretch(y) - cz;
  /** 점 하나의 Z: 모듈 · 서보에 딸린 점(핀 끝 · 플러그 구멍)은 그 부품과 함께 움직인다 */
  const Zp = (p: Pt) => {
    const o = owners.find((r) => inRect(p, r));
    return o ? p.y + o.dz - cz : Z(p.y);
  };

  /** 지금 만들고 있는 부품의 조각들 (part() 안에서 만든 것은 한 묶음으로 들린다) */
  let pieces: THREE.Object3D[] | null = null;
  const add = <T extends THREE.Object3D>(o: T): T => { group.add(o); pieces?.push(o); return o; };
  const asPart = (make: () => void) => {
    pieces = [];
    make();
    pieces = null;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return add(m);
  };
  /** 모서리가 둥근 판 (보드·브레드보드) */
  const slab = (r: { x: number; y: number; w: number; h: number }, h: number, radius: number, material: THREE.Material | THREE.Material[], y0 = 0) => {
    const s = new THREE.Shape();
    const w = r.w, d = Z(r.y + r.h) - Z(r.y), q = Math.min(radius, w / 2, d / 2);
    s.moveTo(-w / 2 + q, -d / 2);
    s.lineTo(w / 2 - q, -d / 2);
    s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + q);
    s.lineTo(w / 2, d / 2 - q);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - q, d / 2);
    s.lineTo(-w / 2 + q, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - q);
    s.lineTo(-w / 2, -d / 2 + q);
    s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + q, -d / 2);
    const geo = track(new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 }));
    geo.rotateX(Math.PI / 2); // 모양(x, y) → 바닥(x, z), 두께는 아래로
    const m = new THREE.Mesh(geo, material);
    m.position.set(X(r.x + r.w / 2), y0 + h, (Z(r.y) + Z(r.y + r.h)) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    return add(m);
  };
  const cyl = (radius: number, h: number, material: THREE.Material, x: number, y: number, z: number, seg = 16) => {
    const m = new THREE.Mesh(track(new THREE.CylinderGeometry(radius, radius, h, seg)), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return add(m);
  };

  /** 그 점의 꽂는 높이: 브레드보드 윗면 또는 보드 핀 위 */
  /** 책상 위 부품의 꽂는 자리(모듈 핀 끝 · 서보 플러그 구멍)와 그 높이 */
  const pads: { x: number; y: number; top: number }[] = [];
  const topAt = (p: Pt) => {
    const pad = pads.find((q) => Math.abs(q.x - p.x) < 1.5 && Math.abs(q.y - p.y) < 1.5);
    if (pad) return pad.top;
    if (scene.breadboards.some((b) => inRect(p, b))) return BB_H;
    const board = scene.boards.find((b) => inRect(p, b));
    return board ? PCB_H + (board.kind === "devkit" ? PIN_SEAT : HEADER_H) : 0;
  };

  const hoverables: THREE.Object3D[] = [];
  /** 물체 하나 = 설명 하나 (올리면 그 물체가 노랗게) */
  const hover = <T extends THREE.Mesh>(m: T, label: string, text: string, control?: HoverInfo["control"]): T => {
    m.updateMatrix();
    const info: HoverInfo = { label, text, marks: [{ geometry: m.geometry, matrix: m.matrix }], control, lift: pieces ?? [m] };
    m.userData.resolve = () => info;
    hoverables.push(m);
    return m;
  };
  const markGeo = track(new THREE.BoxGeometry(9, 2, 9));
  const anchors: Anchor[] = [];
  const spots: Built["spots"] = [];
  const flows: Built["flows"] = [];
  // 차례대로 흐르는 길을 엮기 위해 부품 · 선마다의 길을 따로 적어 둔다
  const ledCurves: THREE.Curve<THREE.Vector3>[] = [];
  const resCurves = new Map<Part3D, THREE.Curve<THREE.Vector3>>();
  const wireCurves: THREE.Curve<THREE.Vector3>[] = [];
  let boardLed: THREE.MeshToonMaterial | undefined;
  const leds: Built["leds"] = [];
  /** 이름표: 같은 이름은 장면에 한 번만 (LED 가 셋이어도 이름표는 하나) */
  const anchor = (label: string, text: string, color: string, position: THREE.Vector3, { once = true, kind = "lesson" as Anchor["kind"], pin = false } = {}) => {
    if (!spots.some((s) => s.label === label)) spots.push({ label, text });
    if (once && anchors.some((a) => a.label === label)) return;
    anchors.push({ id: `${label}-${anchors.length}`, label, text, color, position, kind, pin });
  };

  // ── 브레드보드: 흰 판 + 구멍 + 빨강·파랑 줄 + 가운데 홈
  for (const bb of scene.breadboards) {
    const body = slab(bb, BB_H, 7, [mat("#fbf7ee"), mat("#dfd0b6")]);
    {
      const xs = [...new Set(bb.holes.map(([x]) => x))].sort((a, b) => a - b);
      const gapMid = (bb.gap[0] + bb.gap[1]) / 2;
      const split = bb.gap[1] > bb.gap[0];
      const at = (x: number, y: number) => new THREE.Matrix4().makeTranslation(X(x), BB_H + 0.6, Z(y));
      body.userData.resolve = (hit: THREE.Intersection): HoverInfo => {
        const px = hit.point.x + cx, py = unstretch(hit.point.z + cz);
        for (const r of bb.rails) {
          if (Math.abs(r.y - py) < 8) return { label: r.plus ? "+ 줄" : "− 줄", text: r.plus ? TEXT.railPlus : TEXT.railMinus, marks: r.xs.map((x) => ({ geometry: markGeo, matrix: at(x, r.y) })) };
        }
        const col = xs.findIndex((x) => Math.abs(x - px) < 8);
        const near = bb.holes.filter(([x]) => Math.abs(x - xs[col]) < 0.5);
        if (col >= 0 && near.some(([, y]) => Math.abs(y - py) < 9)) {
          const upper = py < gapMid;
          const five = split ? near.filter(([, y]) => (y < gapMid) === upper) : near;
          return { label: `${col + 1}번 줄`, text: TEXT.hole, marks: five.map(([x, y]) => ({ geometry: markGeo, matrix: at(x, y) })) };
        }
        return { label: "브레드보드", text: TEXT.breadboard };
      };
      hoverables.push(body);
    }
    if (bb.gap[1] > bb.gap[0]) box(bb.w - 12, 1.2, bb.gap[1] - bb.gap[0], noOutline(mat("#d7d2c6")), X(bb.x + bb.w / 2), BB_H + 0.1, Z((bb.gap[0] + bb.gap[1]) / 2));
    const holeGeo = track(new THREE.BoxGeometry(5, 1.2, 5));
    const all: [number, number][] = [...bb.holes, ...bb.rails.flatMap((r) => r.xs.map((x) => [x, r.y] as [number, number]))];
    const holes = new THREE.InstancedMesh(holeGeo, noOutline(mat("#4a4338")), all.length);
    const m4 = new THREE.Matrix4();
    all.forEach(([x, y], i) => holes.setMatrixAt(i, m4.makeTranslation(X(x), BB_H + 0.05, Z(y))));
    add(holes);
    track(holes);
    for (const r of bb.rails) {
      const topSide = r.y < bb.y + bb.h / 2;
      const lineY = topSide ? (r.plus ? r.y - 8 : r.y + 8) : r.plus ? r.y + 8 : r.y - 8;
      box(bb.w - 28, 0.8, 2, noOutline(mat(r.plus ? "#e03131" : "#1971c2")), X(bb.x + bb.w / 2), BB_H + 0.3, Z(lineY));
    }
  }
  if (scene.breadboards.length) spots.push({ label: "브레드보드", text: TEXT.breadboard });

  // ── 보드
  const metalLight = mat("#d9dde3");
  const metal = mat("#b4bac4");
  const gold = mat("#e8b93c");
  const plastic = mat("#26262c");
  for (const b of scene.boards) {
    const devkit = b.kind === "devkit";
    const pcb = devkit ? "#1e2026" : "#1d1d1f";
    // 보드 판: 설명만 뜬다 (들리거나 노랗게 칠해지지 않는다 — 판은 넓어서 그 위의 부품에 올릴 때마다 함께 반응하면 어지럽다)
    {
      const pcbMesh = slab(b, PCB_H, devkit ? 8 : 16, [mat(pcb), mat(devkit ? "#343946" : "#34343a")]);
      const info: HoverInfo = { label: b.name, text: TEXT.board };
      pcbMesh.userData.resolve = () => info;
      hoverables.push(pcbMesh);
    }
    const top = PCB_H;
    const at = (px: number, py: number) => [X(px), Z(py)] as const;

    // 흰 글자(실크): 핀 이름을 판 위에 그린 그림 한 장
    {
      const S = 4;
      const canvas = document.createElement("canvas");
      canvas.width = b.w * S;
      const kz = devkit ? F : 1; // 보드 안의 세로 길이 배수
      canvas.height = b.h * kz * S;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(S, S);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const rows = new Map<number, typeof b.pins>();
      for (const p of b.pins) rows.set(p.y, [...(rows.get(p.y) ?? []), p]);
      if (devkit) {
        // 핀 줄 안쪽에 세로 글자
        ctx.font = "700 9px system-ui, sans-serif";
        for (const p of b.pins) {
          const inward = p.y < b.y + b.h / 2 ? 1 : -1;
          ctx.save();
          ctx.translate(p.x - b.x, (p.y - b.y) * kz + inward * 22);
          ctx.rotate(-Math.PI / 2);
          ctx.globalAlpha = p.used ? 1 : 0.55;
          ctx.fillText(p.label, 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 0.9;
        ctx.font = "700 12px system-ui, sans-serif";
        ctx.fillText("ESP32 DEVKIT V1", b.w * 0.27, b.h * kz - 34);
      } else {
        ctx.font = "700 8px system-ui, sans-serif";
        const seen = new Set<string>();
        for (const p of b.pins) {
          const name = p.label.replace(/ [SVG]$/, "");
          if (seen.has(`${name}|${Math.round(p.x)}`) || /^I2C/.test(p.label) && seen.has(name)) continue;
          seen.add(`${name}|${Math.round(p.x)}`);
          seen.add(name);
          // 위 줄·아래 줄 한 줄 핀만 이름을 적는다 (세 줄 묶음은 맨 위 핀의 이름을 같이 쓴다)
          if (/ [SVG]$/.test(p.label) || /^I2C/.test(p.label)) continue;
          ctx.save();
          ctx.translate(p.x - b.x, p.y - b.y - 13);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = "left";
          ctx.globalAlpha = p.used ? 1 : 0.55;
          ctx.fillText(name, 0, 0);
          ctx.restore();
        }
      }
      const tex = track(new THREE.CanvasTexture(canvas));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const silk = new THREE.Mesh(track(new THREE.PlaneGeometry(b.w, b.h * kz)), noOutline(track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))));
      silk.rotation.x = -Math.PI / 2;
      silk.position.set(X(b.x + b.w / 2), top + 0.15, (Z(b.y) + Z(b.y + b.h)) / 2);
      add(silk);
    }

    // ESP32 모듈: 초록 작은 판 + 은색 덮개 + 안테나 무늬 (안테나는 보드 바깥쪽 끝)
    asPart(() => {
      // DevKit 의 WROOM 모듈은 보드 끝에 길게(25.5mm) 놓이고 폭은 핀 두 줄 사이를 거의 채운다(18mm)
      const kz = devkit ? F : 1;
      const c = devkit ? { x: b.x + b.w - 236, y: b.y + 25, w: 232, h: 100 } : b.chip;
      const antennaRight = devkit; // DevKit 은 눕혀 그려 안테나가 오른쪽 끝, Plus 는 모듈이 가로로 놓여 왼쪽
      const antW = devkit ? 56 : Math.min(26, c.w * 0.24);
      hover(box(c.w, 2, c.h * kz, mat("#2a2d36"), X(c.x + c.w / 2), top + 1, Z(c.y + c.h / 2)), "안테나", "WiFi 와 블루투스 신호를 주고받는 구불구불한 금색 길이에요. 손이나 금속으로 가리면 신호가 약해져요.");
      const shield = { x: antennaRight ? c.x + 5 : c.x + antW + 3, y: c.y + 6, w: c.w - antW - 8, h: c.h - 12 };
      hover(box(shield.w, 7, shield.h * kz, metalLight, X(shield.x + shield.w / 2), top + 2 + 3.5, Z(shield.y + shield.h / 2)), "ESP32 모듈", TEXT.module);
      // 덮개 위 글자
      const cv = document.createElement("canvas");
      cv.width = 256;
      cv.height = Math.round((256 * shield.h * kz) / shield.w);
      const g = cv.getContext("2d")!;
      g.fillStyle = "#3a3f4a";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "700 40px system-ui, sans-serif";
      g.fillText("ESP32", 150, cv.height / 2 - 14);
      g.font = "600 18px system-ui, sans-serif";
      g.fillText("WROOM-32", 150, cv.height / 2 + 22);
      // 와이파이 무늬
      g.strokeStyle = "#3a3f4a";
      g.lineWidth = 7;
      g.lineCap = "round";
      for (const rad of [14, 28, 42]) {
        g.beginPath();
        g.arc(52, cv.height / 2 + 22, rad, -Math.PI * 0.78, -Math.PI * 0.22);
        g.stroke();
      }
      g.beginPath();
      g.arc(52, cv.height / 2 + 22, 5, 0, Math.PI * 2);
      g.fill();
      const t = track(new THREE.CanvasTexture(cv));
      t.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(track(new THREE.PlaneGeometry(shield.w, shield.h * kz)), noOutline(track(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }))));
      plate.rotation.x = -Math.PI / 2;
      plate.position.set(X(shield.x + shield.w / 2), top + 9.2, Z(shield.y + shield.h / 2));
      add(plate);
      // 안테나: 구불구불한 금색 길
      const ax = antennaRight ? c.x + c.w - antW + 2 : c.x + 4;
      const steps = 6, sh = (c.h - 16) / steps;
      for (let i = 0; i < steps; i++) {
        box(antW - 8, 0.6, 2, noOutline(gold), X(ax + (antW - 6) / 2), top + 2.3, Z(c.y + 8 + i * sh));
        box(2, 0.6, sh * kz, noOutline(gold), X(ax + (i % 2 ? 1 : antW - 7)), top + 2.3, Z(c.y + 8 + i * sh + sh / 2));
      }
      anchor("ESP32 모듈", TEXT.module, "#f08c00", new THREE.Vector3(X(shield.x + shield.w / 2), top + 10, Z(shield.y + shield.h / 2)), { kind: "board" });
    });

    // USB: 은색 통 + 안쪽 검은 입구
    asPart(() => {
      const u = b.usb;
      hover(box(u.w, 9, u.h, metalLight, X(u.x + u.w / 2), top + 4.5 - 1, Z(u.y + u.h / 2)), "USB", TEXT.usb);
      box(3, 4.5, u.h - 10, plastic, X(u.x + 1.2), top + 3.5, Z(u.y + u.h / 2));
      anchor("USB", TEXT.usb, "#1c7ed6", new THREE.Vector3(X(u.x + u.w / 2), top + 9, Z(u.y + u.h / 2)), { kind: "board" });
    });

    // 작은 부품들: 버튼 · 칩 · 전원 부품 · 내장 LED (DevKit 만 — 실제 보드의 자리에 가깝게)
    if (devkit) {
      const u = b.usb;
      const [ux] = at(u.x + u.w, 0);
      for (const [name, dy] of [["EN", -44], ["BOOT", 44]] as const) {
        const [, bz] = at(0, b.y + b.h / 2 + dy * 0.82);
        asPart(() => {
          hover(box(15, 4, 13, metal, ux + 4, top + 2, bz), `${name} 버튼`, name === "EN" ? "누르면 보드가 처음부터 다시 시작해요." : "새 프로그램을 받을 때 쓰는 버튼이에요. 평소에는 누르지 않아요.");
          cyl(3.2, 2.4, plastic, ux + 4, top + 5, bz);
        });
        if (name === "BOOT") anchor("EN · BOOT 버튼", TEXT.button, "#868e96", new THREE.Vector3(ux + 4, top + 7, bz), { kind: "board" });
      }
      // USB 칩 · 전원 조절 부품 · 작은 부품들
      const [chipX, chipZ] = at(b.x + 118, b.y + b.h / 2 + 4);
      hover(box(26, 3.2, 26, plastic, chipX, top + 1.6, chipZ), "USB 칩", TEXT.usbChip);
      const [regX, regZ] = at(b.x + 78, b.y + b.h / 2 - 2);
      hover(box(15, 4.5, 22, plastic, regX, top + 2.25, regZ), "전원 조절 부품", TEXT.regulator);
      box(8, 4.5, 12, metal, regX - 11, top + 2.25, regZ);
      for (const [dx, dz, w, d, c] of [[150, -26, 7, 4, "#c9a26b"], [150, 28, 7, 4, "#c9a26b"], [176, -8, 4, 7, "#3a3a42"], [176, 12, 4, 7, "#c9a26b"], [96, 34, 7, 4, "#3a3a42"], [96, -36, 7, 4, "#c9a26b"]] as const) {
        const [sx, sz] = at(b.x + dx, b.y + b.h / 2 + dz);
        box(w, 2.4, d, noOutline(mat(c)), sx, top + 1.2, sz);
      }
      // 내장 LED 둘: 전원(빨강) · 2번 핀(파랑)
      const [l1x, l1z] = at(b.x + 200, b.y + b.h / 2 - 22);
      hover(box(7, 2.6, 4, noOutline(mat("#ff6b6b", { emissive: "#e03131", emissiveIntensity: 0.9 })), l1x, top + 1.3, l1z), "전원 LED", TEXT.powerLed);
      const [l2x, l2z] = at(b.x + 200, b.y + b.h / 2 + 22);
      boardLed = noOutline(mat("#74c0fc", { emissive: "#1c7ed6", emissiveIntensity: 0.25 }));
      hover(box(7, 2.6, 4, boardLed, l2x, top + 1.3, l2z), "내장 LED", TEXT.bootLed);
      anchor("내장 LED", TEXT.bootLed, "#1c7ed6", new THREE.Vector3(l2x, top + 4, l2z), { kind: "board" });
    } else {
      // 확장 보드: 네 귀퉁이 나사 구멍
      for (const [hx, hy] of [[b.x + 14, b.y + 14], [b.x + b.w - 14, b.y + 14], [b.x + 14, b.y + b.h - 14], [b.x + b.w - 14, b.y + b.h - 14]]) {
        cyl(5, 0.8, noOutline(mat("#6c757d")), X(hx), top + 0.3, Z(hy), 20);
      }
    }

    // 핀: DevKit 은 검은 받침 띠 + 금색 핀, Plus 는 색깔 소켓
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color();
    const pinInfo = (p: (typeof b.pins)[number]): { label: string; text: string } => {
      const n = p.label;
      const num = Number(/(\d+)/.exec(n.replace(/^I2C /, ""))?.[1] ?? NaN);
      const text =
        /GND|\bG$/.test(n) ? TEXT.gnd
        : /3V3/.test(n) ? TEXT.v33
        : /5V|VIN|\bV$/.test(n) ? TEXT.v5
        : /^(EN|RST)$/.test(n) ? TEXT.reset
        : /SDA|SCL/.test(n) || num === 21 || num === 22 ? TEXT.i2c
        : /^(TX|RX|TX0|RX0)$/.test(n) ? TEXT.serial
        : /^(VP|VN)$/.test(n) || [34, 35, 36, 39].includes(num) ? TEXT.inputOnly
        : TEXT.gpio;
      return { label: n, text: p.used ? `${text} 이번에 선을 꽂는 핀이에요.` : text };
    };
    // 핀 묶음: 서로 붙어 있는 핀끼리(한 줄 · 한 덩어리) 묶어, 마우스를 올리면 묶음째 들리게 한다
    const clusters: (typeof b.pins)[] = [];
    {
      const group = b.pins.map((_, i) => i);
      const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
      b.pins.forEach((p, i) => b.pins.forEach((q, k) => { if (k > i && Math.hypot(p.x - q.x, p.y - q.y) <= 23) group[find(k)] = find(i); }));
      const by = new Map<number, typeof b.pins>();
      b.pins.forEach((p, i) => by.set(find(i), [...(by.get(find(i)) ?? []), p]));
      clusters.push(...by.values());
    }
    /** 묶음 안의 핀 하나에 올렸을 때: 그 핀의 이름과 쓰임, 노란 덧칠은 그 핀만, 들리는 것은 묶음 전체 */
    const pinHover = (mesh: THREE.InstancedMesh, pinsOf: typeof b.pins, lift: THREE.Object3D[]) => {
      mesh.userData.resolve = (hit: THREE.Intersection): HoverInfo | null => {
        const p = hit.instanceId === undefined ? undefined : pinsOf[hit.instanceId];
        if (!p) return null;
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(hit.instanceId!, matrix);
        return { ...pinInfo(p), marks: [{ geometry: mesh.geometry, matrix }], lift };
      };
      hoverables.push(mesh);
    };
    for (const row of clusters) {
      const made: THREE.Object3D[] = [];
      if (devkit) {
        // 검은 받침 띠 + 금색 핀 + (가는 핀을 잡기 쉽게) 보이지 않는 넓은 손잡이
        const xs = row.map((p) => p.x), ys = row.map((p) => p.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        made.push(box(x1 - x0 + 18, 5, Z(y1) - Z(y0) + 12, plastic, X((x0 + x1) / 2), top + 2.5, (Z(y0) + Z(y1)) / 2));
        const pins = new THREE.InstancedMesh(track(new THREE.BoxGeometry(2.8, PIN_LEN, 2.8)), gold, row.length);
        const grip = new THREE.InstancedMesh(track(new THREE.BoxGeometry(13, PIN_LEN, 11)), noOutline(track(new THREE.MeshBasicMaterial({ visible: false }))), row.length);
        row.forEach((p, i) => {
          m4.makeTranslation(X(p.x), top + PIN_LEN / 2, Z(p.y));
          pins.setMatrixAt(i, m4);
          grip.setMatrixAt(i, m4);
        });
        pins.castShadow = true;
        made.push(add(pins), add(grip));
        track(pins);
        track(grip);
        pinHover(grip, row, made);
      } else {
        const base = new THREE.InstancedMesh(track(new THREE.BoxGeometry(14, HEADER_H, 14)), plastic, row.length);
        const cap = new THREE.InstancedMesh(track(new THREE.BoxGeometry(9, 1, 9)), noOutline(mat("#ffffff")), row.length);
        row.forEach((p, i) => {
          base.setMatrixAt(i, m4.makeTranslation(X(p.x), top + HEADER_H / 2, Z(p.y)));
          cap.setMatrixAt(i, m4.makeTranslation(X(p.x), top + HEADER_H + 0.3, Z(p.y)));
          // 안 쓰는 핀은 색을 가라앉힌다 (그림의 "흐린 핀")
          c.set(p.fill);
          if (!p.used) c.lerp(new THREE.Color(pcb), 0.55);
          cap.setColorAt(i, c);
        });
        if (cap.instanceColor) cap.instanceColor.needsUpdate = true;
        base.castShadow = true;
        made.push(add(base), add(cap));
        track(base);
        track(cap);
        pinHover(base, row, made);
      }
    }

    // 이번에 꽂는 핀: 노란 테두리 + 이름표
    const ringMat = noOutline(mat("#ffd43b", { emissive: "#ffd43b", emissiveIntensity: 0.6 }));
    for (const p of b.pins.filter((q) => q.used)) {
      const ring = new THREE.Mesh(track(new THREE.TorusGeometry(11, 1.4, 8, 4)), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = Math.PI / 4;
      ring.position.set(X(p.x), top + 0.8, Z(p.y));
      add(ring);
      const gnd = /GND|\bG$/.test(p.label);
      anchor(p.label.replace(/ \(.*\)$/, ""), gnd ? TEXT.gnd : TEXT.pin, gnd ? "#495057" : "#f08c00", new THREE.Vector3(X(p.x), top + (devkit ? PIN_SEAT : HEADER_H) + 15, Z(p.y)), { once: false, pin: true });
    }
    if (b.pins.some((p) => p.used && !/GND/.test(p.label))) spots.push({ label: "보드 핀", text: TEXT.pin });
    if (b.pins.some((p) => p.used && /GND/.test(p.label)) && !spots.some((s) => s.label === "GND")) spots.push({ label: "GND", text: TEXT.gnd });
  }

  const tube = (pts: THREE.Vector3[], radius: number, material: THREE.Material, tension = 0.5) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", tension);
    const m = new THREE.Mesh(track(new THREE.TubeGeometry(curve, Math.max(16, pts.length * 12), radius, 8)), material);
    m.castShadow = true;
    return add(m);
  };
  const v = (p: Pt, y: number) => new THREE.Vector3(X(p.x), y, Zp(p));
  const near = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
  const isGndPin = (p: Pt) => scene.boards.some((b) => b.pins.some((q) => near(p, q) && /GND|\bG$/.test(q.label)));
  const isMinusRail = (p: Pt) => scene.breadboards.some((bb) => bb.rails.some((r) => !r.plus && Math.abs(r.y - p.y) < 1));
  const leg = noOutline(mat("#aab0ba"));

  /** 구멍에서 올라오는 곧은 다리 */
  const legUp = (p: Pt, h: number) => cyl(1, h + 2, leg, X(p.x), BB_H + h / 2 - 1, Z(p.y), 8);
  const mean = (ps: Pt[]) => ({ x: ps.reduce((n, p) => n + p.x, 0) / ps.length, y: ps.reduce((n, p) => n + p.y, 0) / ps.length });
  /** 글자 · 무늬를 그린 납작한 판 */
  const decal = (w: number, d: number, x: number, y: number, z: number, paint: (g: CanvasRenderingContext2D, cw: number, ch: number) => void) => {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = Math.max(16, Math.round((256 * d) / w));
    paint(cv.getContext("2d")!, cv.width, cv.height);
    const tex = track(new THREE.CanvasTexture(cv));
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, d)), noOutline(track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    return add(m);
  };
  const dark = mat("#26262c");
  const white = mat("#f4f4f1");

  /** LED · 저항이 아닌 부품들 (브레드보드에 꽂는 맨 부품, 책상에 놓는 모듈, 서보) */
  const other = (part: Exclude<Part3D, { type: "led" } | { type: "resistor" }>) => {
    if (part.type === "button") {
      const c = mean(part.legs);
      part.legs.forEach((p) => legUp(p, 3));
      hover(box(36, 9, 36, dark, X(c.x), BB_H + 5.5, Z(c.y)), "버튼", TEXT.tact);
      hover(cyl(11, 7, mat(part.color), X(c.x), BB_H + 12.5, Z(c.y), 24), "버튼", TEXT.tact);
      anchor("버튼", TEXT.tact, "#868e96", new THREE.Vector3(X(c.x), BB_H + 17, Z(c.y)));
    } else if (part.type === "buzzer") {
      const c = mean([part.a, part.b]);
      [part.a, part.b].forEach((p) => legUp(p, 5));
      hover(cyl(17, 18, dark, X(c.x), BB_H + 13, Z(c.y), 28), "부저", TEXT.buzzer);
      cyl(3.5, 1, noOutline(mat("#0d0d10")), X(c.x), BB_H + 22.2, Z(c.y), 16);
      if (part.active) cyl(12, 0.8, noOutline(white), X(c.x), BB_H + 22.3, Z(c.y), 24);
      anchor("부저", TEXT.buzzer, "#495057", new THREE.Vector3(X(c.x), BB_H + 24, Z(c.y)));
    } else if (part.type === "pot") {
      const m = part.legs[1];
      part.legs.forEach((p) => legUp(p, 4));
      hover(box(46, 16, 30, mat("#1971c2"), X(m.x), BB_H + 11, Z(m.y)), "가변저항", TEXT.pot);
      hover(cyl(11, 12, white, X(m.x), BB_H + 25, Z(m.y), 24), "가변저항", TEXT.pot);
      box(2.4, 1, 10, noOutline(dark), X(m.x), BB_H + 31.3, Z(m.y) - 5);
      anchor("가변저항", TEXT.pot, "#1971c2", new THREE.Vector3(X(m.x), BB_H + 32, Z(m.y)));
    } else if (part.type === "photo") {
      const c = mean([part.a, part.b]);
      [part.a, part.b].forEach((p) => legUp(p, 14));
      hover(cyl(11, 5, mat("#ffe8cc"), X(c.x), BB_H + 17, Z(c.y), 24), "포토레지스터", TEXT.photo);
      decal(18, 18, X(c.x), BB_H + 19.7, Z(c.y), (g, w, h) => {
        g.strokeStyle = "#c92a2a";
        g.lineWidth = 22;
        g.lineJoin = "round";
        g.beginPath();
        [[0.15, 0.25], [0.35, 0.25], [0.35, 0.75], [0.6, 0.75], [0.6, 0.25], [0.85, 0.25], [0.85, 0.75]].forEach(([px, py], i) => (i ? g.lineTo(px * w, py * h) : g.moveTo(px * w, py * h)));
        g.stroke();
      });
      anchor("포토레지스터", TEXT.photo, "#e8590c", new THREE.Vector3(X(c.x), BB_H + 21, Z(c.y)));
    } else if (part.type === "tilt") {
      const c = mean([part.a, part.b]);
      [part.a, part.b].forEach((p) => legUp(p, 6));
      hover(cyl(8, 24, dark, X(c.x), BB_H + 18, Z(c.y), 20), "틸트 스위치", TEXT.tilt);
      cyl(8.2, 3, noOutline(mat("#adb5bd")), X(c.x), BB_H + 7.5, Z(c.y), 20);
      anchor("틸트 스위치", TEXT.tilt, "#495057", new THREE.Vector3(X(c.x), BB_H + 31, Z(c.y)));
    } else if (part.type === "rgb") {
      const c = mean(part.legs);
      part.legs.forEach((p) => tube([v(p, BB_H - 2), v(p, BB_H + 10), new THREE.Vector3(X(c.x + (p.x - c.x) * 0.3), BB_H + 22, Z(c.y)), new THREE.Vector3(X(c.x + (p.x - c.x) * 0.3), BB_H + 28, Z(c.y))], 1, leg));
      const glass = mat("#f8f9fa", { transparent: true, opacity: 0.92, emissive: "#ffffff", emissiveIntensity: 0.15 });
      cyl(11, 2.6, glass, X(c.x), BB_H + 29.3, Z(c.y), 28);
      hover(cyl(9.2, 13, glass, X(c.x), BB_H + 37, Z(c.y), 28), "RGB LED", TEXT.rgb);
      const dome = new THREE.Mesh(track(new THREE.SphereGeometry(9.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), glass);
      dome.position.set(X(c.x), BB_H + 43.5, Z(c.y));
      hover(add(dome), "RGB LED", TEXT.rgb);
      // 안에 든 세 색
      [["#e03131", -4, 2], ["#2f9e44", 4, 2], ["#1c7ed6", 0, -4]].forEach(([col, dx, dz]) => cyl(2.6, 6, noOutline(mat(col as string, { emissive: col as string, emissiveIntensity: 0.6 })), X(c.x) + (dx as number), BB_H + 36, Z(c.y) + (dz as number), 10));
      anchor("RGB LED", TEXT.rgb, "#7048e8", new THREE.Vector3(X(c.x), BB_H + 48, Z(c.y)));
    } else if (part.type === "irrx") {
      const m = part.legs[1];
      part.legs.forEach((p) => legUp(p, 8));
      hover(box(30, 24, 12, dark, X(m.x), BB_H + 20, Z(m.y)), "IR 수신기", TEXT.irrx);
      const eye = new THREE.Mesh(track(new THREE.SphereGeometry(7, 16, 10)), mat("#3a3a42"));
      eye.position.set(X(m.x), BB_H + 22, Z(m.y) + 6);
      add(eye);
      anchor("IR 수신기", TEXT.irrx, "#495057", new THREE.Vector3(X(m.x), BB_H + 33, Z(m.y)));
    } else if (part.type === "dip") {
      const w = part.r.x - part.l.x + 18, d = part.r.y - part.l.y - 6;
      const cxm = (part.l.x + part.r.x) / 2, cym = (part.l.y + part.r.y) / 2;
      const name = part.label ? `${part.label} 칩` : "칩";
      hover(box(w, 9, d, dark, X(cxm), BB_H + 6.5, Z(cym)), name, TEXT.dip);
      // 다리: 위 칸 · 아래 칸 구멍마다
      for (let x = part.l.x; x <= part.r.x + 0.5; x += 16) for (const y of [part.l.y, part.r.y]) box(3, 7, 3, leg, X(x), BB_H + 3, Z(y));
      decal(w - 6, d - 4, X(cxm), BB_H + 11.2, Z(cym), (g, cw, ch) => {
        g.fillStyle = "#f1f3f5";
        g.font = `700 ${Math.round(ch * 0.5)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(part.label, cw / 2, ch / 2);
        g.strokeStyle = "#868e96";
        g.lineWidth = 6;
        g.beginPath();
        g.arc(0, ch / 2, ch * 0.2, -Math.PI / 2, Math.PI / 2);
        g.stroke();
      });
      anchor(name, TEXT.dip, "#495057", new THREE.Vector3(X(cxm), BB_H + 12, Z(cym)));
    } else if (part.type === "servo") {
      const { x, y } = part;
      const dzm = stretch(y + 22) - (y + 22);
      const Z = (yy: number) => yy + dzm - cz; // 서보는 한 덩어리로
      const blue = mat("#1971c2");
      hover(box(66, 36, 44, blue, X(x + 33), 18, Z(y + 22)), "서보 모터", TEXT.servo);
      box(80, 4, 14, blue, X(x + 33), 26, Z(y + 22));
      cyl(13, 5, blue, X(x + 44), 38.5, Z(y + 22), 24);
      hover(cyl(5, 6, white, X(x + 44), 43, Z(y + 22), 16), "서보 모터", TEXT.servo);
      box(8, 2.6, 40, white, X(x + 44), 46, Z(y + 22));
      // 세 가닥 선(갈색 G · 빨강 V · 주황 S) → 플러그
      const onBoard = part.onBoard;
      const plugTop = onBoard ? topAt(part.plug[0]) + 14 : 8;
      const left = !onBoard && part.plugBox !== undefined && part.plugBox.x < x;
      ["#8b5a2b", "#e03131", "#f76707"].forEach((color, i) => {
        const end = part.plug[i];
        const from = new THREE.Vector3(X(left ? x : x + 66), 12, Z(y + 13 + i * 9));
        const out = from.clone().add(new THREE.Vector3(left ? -16 : 16, 0, 0));
        const to = v(end, plugTop);
        tube([from, out, out.clone().lerp(to, 0.5).setY(Math.max(18, plugTop + 16)), to.clone().setY(plugTop + 8), to], 1.8, noOutline(mat(color)));
      });
      if (onBoard) {
        const xs = part.plug.map((p) => p.x), ys = part.plug.map((p) => p.y);
        const base = topAt(part.plug[0]);
        box(Math.max(...xs) - Math.min(...xs) + 14, 14, Math.max(...ys) - Math.min(...ys) + 14, dark, X((Math.min(...xs) + Math.max(...xs)) / 2), base + 7.5, Z((Math.min(...ys) + Math.max(...ys)) / 2));
      } else if (part.plugBox) {
        const b = part.plugBox;
        box(b.w, 8, b.h, dark, X(b.x + b.w / 2), 4, Z(b.y + b.h / 2));
        part.plug.forEach((p) => pads.push({ x: p.x, y: p.y, top: 8 }));
      }
      anchor("서보 모터", TEXT.servo, "#1971c2", new THREE.Vector3(X(x + 44), 48, Z(y + 22)));
    } else if (part.type === "module") {
      const { x, y, w, h } = part;
      const dzm = stretch(y + h / 2) - (y + h / 2);
      const Z = (yy: number) => yy + dzm - cz; // 모듈은 한 덩어리로
      const info = MODULE[part.kind] ?? MODULE.generic;
      const name = part.title || info.name;
      const cxm = X(x + w / 2), czm = Z(y + h / 2);
      hover(box(w, 4, h, mat(part.color), cxm, 2, czm), name, info.text);
      // 핀: 판 가장자리의 검은 받침에서 옆으로 뻗은 금색 핀
      const edge = part.side === "bottom" ? y + h : y;
      const dir = part.side === "bottom" ? 1 : -1;
      const xs = part.pins.map((p) => p.x);
      box(Math.max(...xs) - Math.min(...xs) + 14, 6, 7, dark, X((Math.min(...xs) + Math.max(...xs)) / 2), 5, Z(edge - dir * 4));
      for (const p of part.pins) {
        box(2.6, 2.6, 16, gold, X(p.x), 5, Z(edge + dir * 6));
        pads.push({ x: p.x, y: p.y, top: 0 });
      }
      // 핀 이름
      decal(Math.max(...xs) - Math.min(...xs) + 24, 12, X((Math.min(...xs) + Math.max(...xs)) / 2), 4.2, Z(edge - dir * 14), (g, cw, ch) => {
        g.fillStyle = "#ffffff";
        g.font = `700 ${Math.round(ch * 0.62)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        const span = Math.max(...xs) - Math.min(...xs) + 24;
        part.pins.forEach((p) => g.fillText(p.name, ((p.x - Math.min(...xs) + 12) / span) * cw, ch / 2));
      });
      const k = part.kind;
      if (k === "ultrasonic") {
        for (const ex of [x + 36, x + 116]) {
          hover(cyl(24, 22, metalLight, X(ex), 15, Z(y + 34), 28), name, info.text);
          cyl(13, 1, noOutline(mat("#495057")), X(ex), 26.3, Z(y + 34), 24);
        }
      } else if (k === "oled") {
        const sy = part.side === "top" ? y + 48 : y + 10;
        hover(box(90, 3, 54, mat("#0b1f4d"), X(x + 54), 5.5, Z(sy + 27)), name, info.text);
        decal(84, 48, X(x + 54), 7.2, Z(sy + 27), (g, cw, ch) => {
          g.strokeStyle = "#74c0fc";
          g.lineWidth = ch * 0.09;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(cw * 0.12, ch * 0.34);
          g.lineTo(cw * 0.62, ch * 0.34);
          g.moveTo(cw * 0.12, ch * 0.64);
          g.lineTo(cw * 0.86, ch * 0.64);
          g.stroke();
        });
      } else if (k === "rfid") {
        const top = part.side === "top" ? y + 36 : y + 10;
        decal(w - 24, h - 44, cxm, 4.2, Z(top + (h - 48) / 2), (g, cw, ch) => {
          g.strokeStyle = "#a5d8ff";
          g.lineWidth = 9;
          g.strokeRect(8, 8, cw - 16, ch - 16);
          g.lineWidth = 6;
          g.strokeRect(34, 34, cw - 68, ch - 68);
        });
      } else if (k === "dht") {
        hover(box(40, 20, 34, mat("#d0ebff"), X(x + 38), 14, Z(y + 25)), name, info.text);
        for (let i = 0; i < 4; i++) box(28, 0.8, 2.4, noOutline(mat("#74c0fc")), X(x + 38), 24.3, Z(y + 15 + i * 7));
      } else if (k === "pir") {
        const dome = new THREE.Mesh(track(new THREE.SphereGeometry(23, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), white);
        dome.position.set(X(x + 38), 4, Z(y + 32));
        hover(add(dome), name, info.text);
      } else if (k === "sound") {
        hover(cyl(15, 14, dark, X(x + 38), 11, Z(y + 30), 24), name, info.text);
        cyl(8, 1, noOutline(mat("#868e96")), X(x + 38), 18.3, Z(y + 30), 20);
      } else if (k === "flame" || k === "ir" || k === "lm35") {
        hover(box(22, 16, 12, dark, X(x + 38), 12, Z(y + 28)), name, info.text);
        const eye = new THREE.Mesh(track(new THREE.SphereGeometry(6, 16, 10)), mat("#3a3a42"));
        eye.position.set(X(x + 38), 20, Z(y + 28));
        add(eye);
      } else if (k === "joystick") {
        hover(cyl(29, 8, mat("#495057"), X(x + 60), 8, Z(y + 40), 28), name, info.text);
        cyl(6, 22, dark, X(x + 60), 23, Z(y + 40), 16);
        const cap = new THREE.Mesh(track(new THREE.SphereGeometry(15, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2)), dark);
        cap.position.set(X(x + 60), 32, Z(y + 40));
        hover(add(cap), name, info.text);
      } else if (k === "keypad") {
        const keys = ["1", "2", "3", "A", "4", "5", "6", "B", "7", "8", "9", "C", "*", "0", "#", "D"];
        keys.forEach((_, i) => box(30, 3, 21, white, X(x + 12 + (i % 4) * 36 + 15), 5.5, Z(y + 8 + Math.floor(i / 4) * 26 + 10.5)));
        decal(138, 99, X(x + 81), 7.3, Z(y + 57.5), (g, cw, ch) => {
          g.fillStyle = "#343a40";
          g.font = `700 ${Math.round(ch * 0.15)}px system-ui, sans-serif`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          keys.forEach((t, i) => g.fillText(t, ((15 + (i % 4) * 36) / 138) * cw, ((10.5 + Math.floor(i / 4) * 26) / 99) * ch));
        });
      } else if (k === "fan") {
        hover(cyl(12, 20, metalLight, X(x + 55), 14, Z(y + 34), 20), name, info.text);
        cyl(4, 6, dark, X(x + 55), 27, Z(y + 34), 12);
        for (const a of [0, 120, 240]) {
          const blade = new THREE.Mesh(track(new THREE.CylinderGeometry(9, 9, 1.4, 20)), mat("#74c0fc"));
          const rad = (a * Math.PI) / 180;
          blade.scale.set(0.75, 1, 1.5);
          blade.rotation.y = rad;
          blade.position.set(X(x + 55) + Math.sin(rad) * 14, 29, Z(y + 34) + Math.cos(rad) * 14);
          hover(add(blade), name, info.text);
        }
      }
      anchor(name, info.text, part.color, new THREE.Vector3(cxm, k === "ultrasonic" ? 28 : 10, czm));
    }
  };

  // ── 부품
  for (const part of scene.parts) asPart(() => {
    if (part.type === "led") {
      // 다리 둘(긴 다리가 +)이 구멍에서 올라와 머리를 받친다. 머리는 두 구멍 가운데 위
      const headY = BB_H + 28;
      const mid = { x: (part.a.x + part.c.x) / 2, y: (part.a.y + part.c.y) / 2 };
      const top = (p: Pt) => new THREE.Vector3(X(mid.x + (p.x - mid.x) * 0.45), headY, Z(mid.y));
      for (const p of [part.a, part.c]) tube([v(p, BB_H - 2), v(p, BB_H + 12), top(p).setY(headY - 8), top(p)], 1, leg);
      const glass = mat(part.color, { emissive: part.color, emissiveIntensity: 0.12, transparent: true, opacity: 0.92 });
      const ledIndex = leds.length;
      // 빛 번짐: 켜졌을 때 LED 둘레가 그 색으로 물든다
      const haloCanvas = document.createElement("canvas");
      haloCanvas.width = haloCanvas.height = 128;
      const hg = haloCanvas.getContext("2d")!;
      const grad = hg.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,0.75)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.3)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      hg.fillStyle = grad;
      hg.fillRect(0, 0, 128, 128);
      const haloMat = noOutline(track(new THREE.SpriteMaterial({ map: track(new THREE.CanvasTexture(haloCanvas)), color: part.color, transparent: true, depthWrite: false, depthTest: false })));
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(92, 92, 1);
      halo.position.set(X(mid.x), headY + 10, Z(mid.y));
      halo.visible = false;
      halo.renderOrder = 1;
      add(halo);
      cyl(11, 2.6, glass, X(mid.x), headY + 1.3, Z(mid.y), 28);
      hover(cyl(9.2, 13, glass, X(mid.x), headY + 9, Z(mid.y), 28), "LED", TEXT.led, { type: "led", index: ledIndex });
      const dome = new THREE.Mesh(track(new THREE.SphereGeometry(9.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), glass);
      dome.position.set(X(mid.x), headY + 15.5, Z(mid.y));
      // 유리의 반짝임 (흰 점 둘)
      const shine = noOutline(track(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85 })));
      const s1 = new THREE.Mesh(track(new THREE.SphereGeometry(2.4, 10, 8)), shine);
      s1.scale.set(1, 1.7, 1);
      s1.position.set(X(mid.x) - 5.2, headY + 14, Z(mid.y) + 6.4);
      const s2 = new THREE.Mesh(track(new THREE.SphereGeometry(1.3, 8, 6)), shine);
      s2.position.set(X(mid.x) - 6.4, headY + 7.5, Z(mid.y) + 6);
      add(s1);
      add(s2);
      leds.push({ glass, halo, shine });
      hover(add(dome), "LED", TEXT.led, { type: "led", index: ledIndex });
      const ledCurve = new THREE.CatmullRomCurve3([v(part.a, BB_H), v(part.a, BB_H + 12), top(part.a), top(part.c), v(part.c, BB_H + 12), v(part.c, BB_H)], false, "catmullrom", 0.2);
      flows.push(ledCurve);
      ledCurves.push(ledCurve);
      anchor("LED", TEXT.led, part.color, new THREE.Vector3(X(mid.x), headY + 18, Z(mid.y)));
    } else if (part.type === "resistor") {
      // 저항: 두 구멍 사이에 누운 몸통 + 색 띠, 양 끝 다리는 꺾여 구멍으로
      const y = BB_H + 7;
      const a = v(part.a, y), b = v(part.b, y);
      tube([v(part.a, BB_H - 2), a.clone().setY(y - 1), a, b, b.clone().setY(y - 1), v(part.b, BB_H - 2)], 1, leg, 0.05);
      const dir = b.clone().sub(a).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const center = a.clone().add(b).multiplyScalar(0.5);
      const body = new THREE.Mesh(track(new THREE.CapsuleGeometry(5, 20, 6, 16)), mat("#e3c08a"));
      body.quaternion.copy(quat);
      body.position.copy(center);
      body.castShadow = true;
      hover(add(body), part.label ? `${part.label} 저항` : "저항", TEXT.resistor, /220/.test(part.label ?? "") ? { type: "resistor" } : undefined);
      part.bands.forEach((color, i) => {
        const band = new THREE.Mesh(track(new THREE.CylinderGeometry(5.3, 5.3, 2.6, 16)), noOutline(mat(color)));
        band.quaternion.copy(quat);
        band.position.copy(center).add(dir.clone().multiplyScalar(-7 + i * 6));
        add(band);
      });
      const resCurve = new THREE.CatmullRomCurve3([v(part.a, BB_H), a, b, v(part.b, BB_H)], false, "catmullrom", 0.05);
      flows.push(resCurve);
      resCurves.set(part, resCurve);
      anchor(part.label ? `${part.label} 저항` : "저항", TEXT.resistor, "#c08a3e", center.clone().setY(y + 8));
    } else {
      other(part);
    }
  });

  // ── 선: 양 끝에서 곧게 올라와 둥글게 넘어간다. 길수록, 뒤에 그린 선일수록 조금 더 높이(겹치지 않게)
  const wires: Built["wires"] = scene.wires.map((w, i) => {
    const y0 = topAt(w.from), y1 = topAt(w.to);
    const dist = Math.hypot(w.to.x - w.from.x, w.to.y - w.from.y);
    const lift = 22 + Math.min(70, dist * 0.28) + (i % 3) * 5;
    const plug = (end: "f" | "m") => (end === "f" ? 14 : 10);
    const a0 = v(w.from, y0 + plug(w.ends[0])), b0 = v(w.to, y1 + plug(w.ends[1]));
    const peak = Math.max(a0.y, b0.y) + lift;
    const a1 = a0.clone().setY(a0.y + lift * 0.45), b1 = b0.clone().setY(b0.y + lift * 0.45);
    const mid = a0.clone().add(b0).multiplyScalar(0.5).setY(peak);
    const qa = a0.clone().lerp(b0, 0.22).setY(peak - lift * 0.12), qb = a0.clone().lerp(b0, 0.78).setY(peak - lift * 0.12);
    const material = mat(w.color, { transparent: true });
    const pts = [a0, a1, qa, mid, qb, b1, b0];
    const objects: THREE.Mesh[] = [tube(pts, 3, material)];
    // 전기는 GND(− 줄 · GND 핀) 쪽으로 흘러간다
    const toFrom = isGndPin(w.from) || (isMinusRail(w.from) && !isGndPin(w.to));
    const wireCurve = new THREE.CatmullRomCurve3(toFrom ? [...pts].reverse() : pts);
    flows.push(wireCurve);
    wireCurves.push(wireCurve);
    // 끝 머리: f = 핀에 씌우는 검은 머리, m = 구멍에 꽂는 핀 끝
    const headMat = mat("#26262c", { transparent: true });
    [[w.from, y0, w.ends[0]] as const, [w.to, y1, w.ends[1]] as const].forEach(([p, y, end]) => {
      const h = plug(end);
      objects.push(box(end === "f" ? 10 : 6, h, end === "f" ? 10 : 6, headMat, X(p.x), y + h / 2 + 0.5, Z(p.y)));
      if (end === "m") objects.push(box(1.6, 5, 1.6, leg, X(p.x), y - 1.5, Z(p.y)));
    });
    const row = scene.rows.find((r) => r.colors.includes(w.color));
    const info: HoverInfo = { label: row ? row.part : "선", text: row ? `→ ${row.to}` : TEXT.wire, wire: w.color };
    objects.forEach((o) => {
      o.userData.wire = i;
      o.userData.resolve = () => info;
      hoverables.push(o);
    });
    return { color: w.color, objects };
  });

  // ── LED 회로마다 차례대로 흐르는 길: 핀 → 선 → 저항 → LED → (점퍼 → − 줄) → GND
  const chains: Built["chains"] = [];
  {
    const mids = scene.breadboards.map((bb) => ({ bb, mid: (bb.gap[0] + bb.gap[1]) / 2 }));
    /** 같은 줄(속에서 이어진 다섯 칸)인지 */
    const sameStrip = (a: Pt, b: Pt) => {
      if (Math.abs(a.x - b.x) >= 1) return false;
      const m = mids.find(({ bb }) => inRect(a, bb) && inRect(b, bb));
      return Boolean(m) && (m!.bb.gap[1] <= m!.bb.gap[0] || (a.y < m!.mid) === (b.y < m!.mid));
    };
    const sameRail = (a: Pt, b: Pt) => isMinusRail(a) && isMinusRail(b) && Math.abs(a.y - b.y) < 1;
    const backward = (c: THREE.Curve<THREE.Vector3>) => new THREE.CatmullRomCurve3(c.getPoints(24).reverse());
    const pinPoint = (p: Pt) => scene.boards.flatMap((b) => b.pins).find((q) => near(p, q));
    const resistors = scene.parts.filter((p): p is Extract<Part3D, { type: "resistor" }> => p.type === "resistor");
    scene.parts.filter((p): p is Extract<Part3D, { type: "led" }> => p.type === "led").forEach((led, k) => {
      const r = resistors.find((x) => sameStrip(x.a, led.a) || sameStrip(x.b, led.a));
      const entry = r ? (sameStrip(r.a, led.a) ? r.b : r.a) : led.a;
      // 핀에서 오는 선: 한쪽 끝이 들어가는 줄, 다른 쪽 끝이 (GND 가 아닌) 보드 핀
      const wi = scene.wires.findIndex((w) => (sameStrip(w.to, entry) && pinPoint(w.from) && !isGndPin(w.from)) || (sameStrip(w.from, entry) && pinPoint(w.to) && !isGndPin(w.to)));
      if (wi < 0) return;
      const w = scene.wires[wi];
      const fromPin = Boolean(pinPoint(w.from)) && !isGndPin(w.from);
      const curves: THREE.Curve<THREE.Vector3>[] = [fromPin ? wireCurves[wi] : backward(wireCurves[wi])];
      if (r) curves.push(sameStrip(r.b, led.a) ? resCurves.get(r)! : backward(resCurves.get(r)!));
      const toLed = curves.reduce((n, c) => n + c.getLength(), 0);
      curves.push(ledCurves[k]);
      // 짧은 다리에서 나가는 선 → (− 줄이면 그 줄에서 GND 핀으로 가는 선까지)
      const oi = scene.wires.findIndex((x) => sameStrip(x.from, led.c) || sameStrip(x.to, led.c));
      if (oi >= 0) {
        const o = scene.wires[oi];
        curves.push(wireCurves[oi]); // 선의 길은 이미 GND 쪽을 향한다
        const far = sameStrip(o.from, led.c) ? o.to : o.from;
        const gi = isGndPin(far) ? -1 : scene.wires.findIndex((x, i) => i !== oi && ((sameRail(x.from, far) && isGndPin(x.to)) || (sameRail(x.to, far) && isGndPin(x.from))));
        if (gi >= 0) curves.push(wireCurves[gi]);
      }
      const pin = fromPin ? w.from : w.to;
      chains.push({ led: k, curves, pin: v(pin, topAt(pin) + 2), toLed });
    });
    // 모든 LED 의 길을 찾았을 때만 쓴다 (일부만 찾으면 나머지가 멈춘 것처럼 보인다)
    if (chains.length !== ledCurves.length) chains.length = 0;
  }

  return { group, wires, hoverables, flows, leds, chains, boardLed, anchors, spots, size: { w: maxX - minX, d: maxY - minY }, dispose: () => disposables.forEach((d) => d.dispose()) };
}
