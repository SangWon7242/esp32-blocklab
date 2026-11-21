import { Component, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Armchair, Cable, ShieldAlert, TriangleAlert, ChevronLeft, Map as MapIcon, ChevronRight, CircuitBoard, Eye, Hand, ListOrdered, LocateFixed, Minus, Play, Plus, RotateCcw, RotateCw, Square, Sun, Thermometer, Volume2, VolumeX, X as XIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { behaviorFor } from "@/track/sim/behaviors";
import { readDevices, type Device } from "@/track/sim/circuit";
import { defaultInputs, Simulator } from "@/track/sim/engine";
import { JUMPER_5V_NOTICE } from "@/track/board";
import { chapterSafety } from "@/track/safety";
import { SAFETY_TONE, SafetyBody } from "../SafetyNotice";
import type { Scene3D } from "@/track/wiring3d";
import { buildAssembly } from "./assembly";
import { withGlbDevkit } from "./devkitGlb";
import { withGlbExpansion } from "./expansionGlb";
import { makeLayout, siteLayout } from "./layout";
import { OledZoom } from "./OledZoom";
import { PinoutDialog } from "./PinoutDialog";
import { dioramaRoom } from "./diorama";
import { Schematic, schematicRows } from "./Schematic";
import { anchorsOf, Scene3DView } from "./Scene";
import { createViewerStore, useViewer, ViewerContext, type ViewerState } from "./store";

/*
 * 3D 배선 보기 (React Three Fiber).
 *   - 보기: 끌기 · W A S D 옮기기, Q / E 90° 돌리기, 휠 크게, R 처음으로
 *   - 부품: 올리면 설명 · 살짝 들림, 누르면 원형 빛 + 부품 카드(점선으로 이어짐)
 *   - 실행(▶ · Space): 그 챕터 완성 코드의 동작이 돈다. 버튼을 누르고, 손잡이를 돌리고, 자동차를 끌면 LED · 서보 · OLED 가 따라 움직인다
 */

const LED_COLORS = [["빨강", "#e03131"], ["노랑", "#f5b800"], ["초록", "#2f9e44"], ["파랑", "#1c7ed6"], ["흰색", "#f1f3f5"]] as const;
const OHMS = [["220Ω", 1], ["1kΩ", 0.5], ["10kΩ", 0.14]] as const;
const ink = "border-[#0f2239]/80";

type Props = {
  scene: Scene3D;
  /** 챕터 id: 실행할 동작을 고른다 */
  chapterId?: string;
  onUnsupported?: () => void;
  /** 큰 창: 넓으면 목록을 옆에 */
  large?: boolean;
  /** 보기 단추 줄 끝에 붙일 것 (크게 보기 등) */
  toolbar?: ReactNode;
  /** 작업대: 3D 가 부모 칸을 꽉 채우고 연결 목록은 infoContainer 로 보낸다 */
  stage?: boolean;
  infoContainer?: HTMLElement | null;
};

export function Wiring3DView(props: Props) {
  const [store] = useState(createViewerStore);
  return (
    <ViewerContext.Provider value={store}>
      <Viewer {...props} />
    </ViewerContext.Provider>
  );
}

function Viewer({ scene: sceneIn, chapterId, onUnsupported, large, toolbar, stage, infoContainer }: Props) {
  // 기본 보드는 실물 모델 DevKit 으로(devkitGlb.tsx), 확장 보드는 실물 조립 모델로(expansionGlb.tsx)
  const scene = useMemo(() => withGlbExpansion(withGlbDevkit(sceneIn)), [sceneIn]);
  // 융합 챕터: 현장 보기(가전 · 가구에 단 모듈로 시뮬레이션)가 먼저, 회로 보기는 배선만
  const room = dioramaRoom(chapterId);
  const [mode, setMode] = useState<"site" | "circuit">(room ? "site" : "circuit");
  const [modeFor, setModeFor] = useState(chapterId);
  if (modeFor !== chapterId) { setModeFor(chapterId); setMode(room ? "site" : "circuit"); }
  const site = mode === "site" && Boolean(room);
  const L = useMemo(() => (site && room ? siteLayout(room) : makeLayout(scene)), [scene, site, room]);
  const anchors = useMemo(() => (site ? [] : anchorsOf(scene, L)), [scene, L, site]);
  const set = useViewer((s) => s.set);
  const behavior = behaviorFor(chapterId);
  // 장면이 바뀌면 시뮬레이션 · 조립 순서도 새로
  useEffect(() => {
    const devices = readDevices(scene);
    set({ sim: new Simulator(devices, behavior, defaultInputs()), devices, running: false, selected: null, hover: null, picked: null, readings: [], serial: [], assembly: buildAssembly(scene), step: null, chapterId: chapterId ?? null, oledZoom: null });
  }, [scene, behavior, set, chapterId]);
  const devices = useViewer((s) => s.devices);
  const has = (k: Device["kind"]) => devices.some((d) => d.kind === k);
  const running = useViewer((s) => s.running);
  const sound = useViewer((s) => s.sound);
  const hover = useViewer((s) => s.hover);
  const selected = useViewer((s) => s.selected);
  const topView = useViewer((s) => s.topView);
  const camera = useViewer((s) => s.camera);
  const sim = useViewer((s) => s.sim);
  const dom = useViewer((s) => s.dom);
  const invalidate = useViewer((s) => s.invalidate);
  const step = useViewer((s) => s.step);
  const assembly = useViewer((s) => s.assembly);
  const hasSchematic = schematicRows(scene).length > 0;
  // 조립 안전: 위험한 챕터는 조립 순서 첫 단계에서 「USB 를 뺐어요」 를 눌러야 다음으로 간다(챕터마다 다시)
  const safety = chapterSafety(chapterId);
  const [safetyOk, setSafetyOk] = useState(false);
  const [safetyFor, setSafetyFor] = useState(chapterId);
  if (safetyFor !== chapterId) { setSafetyFor(chapterId); setSafetyOk(false); }
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [pinout, setPinout] = useState(false);
  const [schematic, setSchematic] = useState(Boolean(stage || large));
  const boxRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useBuzzerSound(running && sound);

  const run = (on: boolean) => {
    if (!sim) return;
    if (on) sim.reset();
    // 실행하면 조립 순서 보기를 닫고 다 꽂힌 모습으로
    set({ running: on, readings: [], serial: [], ...(on ? { step: null } : {}) });
    invalidate();
  };

  // 조립 순서: 켜면 처음(보드 놓기)부터. 실행 · 고른 부품은 멈춘다
  const goStep = (n: number | null) => {
    const last = (assembly?.steps.length ?? 1) - 1;
    let next = n === null ? null : Math.max(0, Math.min(last, n));
    // 안전 확인 전에는 첫 단계를 넘지 않는다
    if (next !== null && next > 0 && safety && !safetyOk) next = 0;
    set({ step: next, ...(next !== null ? { running: false, selected: null, picked: null, hover: null } : {}) });
    invalidate();
  };

  // 마우스 옆 설명: 마우스를 따라간다
  const moveTip = (e: ReactPointerEvent) => {
    const node = tipRef.current, box = boxRef.current;
    if (!node || !box) return;
    const b = box.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    const w = node.offsetWidth || 240, h = node.offsetHeight || 60;
    const left = Math.min(Math.max(8, x + 16), b.width - w - 8);
    const top = y + 18 + h > b.height - 8 ? y - h - 12 : y + 18;
    node.style.transform = `translate(${left}px, ${Math.max(8, top)}px)`;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " && behavior && e.target === e.currentTarget) { e.preventDefault(); run(!running); }
    else if (e.key === "Escape" && selected) { set({ selected: null }); invalidate(); }
    else if (e.key === "Escape" && step !== null) goStep(null);
    else if (step !== null && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); goStep(step + (e.key === "ArrowRight" ? 1 : -1)); }
  };

  const tall = scene.boards.length > 0 && scene.breadboards.length > 0;
  const tool = "size-8";
  const canvas = (
    <div
      ref={boxRef}
      className={cn("overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-ring/60", stage ? "absolute inset-0" : "relative w-full rounded-xl border bg-[#f8f4ec] dark:bg-[#24262b]", !stage && (large ? "h-[min(70dvh,42rem)]" : tall ? "aspect-[4/3] max-h-[70dvh]" : "aspect-[16/10] max-h-[70dvh]"))}
      data-testid="wiring-3d"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={moveTip}
    >
      <GlBoundary onError={onUnsupported}>
      <Canvas
        orthographic
        frameloop="demand"
        shadows="variance"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
        camera={{ zoom: 1, position: [0, 600, 600], near: -10000, far: 10000 }}
        style={{ position: "absolute", inset: 0, touchAction: "none" }}
        aria-label={`3D 배선 보기: ${scene.rows.map((r) => `${r.part} → ${r.to}`).join(", ")}`}
      >
        <Scene3DView key={site ? "site" : "circuit"} scene={scene} L={L} anchors={anchors} cardsRoom={!site && Boolean(stage || large)} site={site} />
      </Canvas>
      </GlBoundary>

      {/* 설명 카드(넓을 때) · 이름표(좁을 때): 부품 위의 점에서 점선으로 */}
      <div ref={(el) => { dom.callouts = el; }} data-mode="pills" className="group/callouts pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-150" data-testid="wiring-3d-callouts">
        <svg className="absolute inset-0 size-full" aria-hidden>
          {anchors.map((a) => <line key={a.id} ref={nodeRef(dom, a.id, "line")} stroke={a.color} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 5" />)}
        </svg>
        {anchors.map((a) => <span key={`dot-${a.id}`} ref={nodeRef(dom, a.id, "dot")} className="absolute top-0 left-0 size-3 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(15,34,57,0.85)] will-change-transform" style={{ background: a.color }} />)}
        {anchors.map((a) => (
          <div key={a.id} ref={nodeRef(dom, a.id, "card")} className={cn(
            "absolute top-0 left-0 border bg-white text-[#0f2239] will-change-transform", ink,
            "group-data-[mode=cards]/callouts:w-[200px] group-data-[mode=cards]/callouts:rounded-xl group-data-[mode=cards]/callouts:px-3 group-data-[mode=cards]/callouts:py-2 group-data-[mode=cards]/callouts:shadow-[0_3px_0_rgba(15,34,57,0.18)]",
            "group-data-[mode=pills]/callouts:rounded-full group-data-[mode=pills]/callouts:px-2 group-data-[mode=pills]/callouts:py-0.5 group-data-[mode=pills]/callouts:shadow-[0_2px_0_rgba(15,34,57,0.3)]",
          )}>
            <p className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap group-data-[mode=cards]/callouts:text-[0.8rem]"><span className="size-2 shrink-0 rounded-full" style={{ background: a.color }} />{a.label}</p>
            <p className="mt-0.5 line-clamp-3 text-[0.7rem] leading-snug break-keep text-[#5b6168] group-data-[mode=pills]/callouts:hidden">{a.text}</p>
          </div>
        ))}
      </div>

      {/* 누른 부품 ↔ 부품 카드 점선 */}
      <svg className="pointer-events-none absolute inset-0 z-[5] size-full" aria-hidden>
        <path ref={(el) => { dom.leaderHalo = el; }} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "none" }} />
        <path ref={(el) => { dom.leader = el; }} fill="none" stroke="#f76707" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 6" style={{ display: "none" }} />
        <g ref={(el) => { dom.leaderDot = el; }} style={{ display: "none" }}><circle r="9" fill="#ffffff" /><circle r="7" fill="#f76707" /><circle r="3.2" fill="#ffffff" /></g>
      </svg>

      {/* 마우스 옆 설명 */}
      <div ref={tipRef} role="tooltip" className={cn("pointer-events-none absolute top-0 left-0 z-20 max-w-64 rounded-xl border bg-white px-3 py-2 text-[#0f2239] shadow-[0_3px_0_rgba(15,34,57,0.25)] will-change-transform", ink, (!hover || hover.id === selected?.id) && "hidden")} data-testid="wiring-3d-tip">
        <p className="text-sm font-bold">{hover?.label}</p>
        <p className="mt-0.5 text-[0.8rem] leading-snug break-keep text-[#5b6168]">{hover?.text}</p>
      </div>

      {/* 위: 실행 · 소리 · (크게 보기) */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-1">
        {behavior && (
          <Button type="button" size="sm" variant="outline" className={cn("h-8", running ? "border-[#e8590c] bg-[#e8590c] text-white hover:bg-[#d9480f] hover:text-white" : "bg-background/95")} aria-pressed={running} data-testid="wiring-3d-run" onClick={() => run(!running)} title="실행 (스페이스)">
            {running ? <Square className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}{running ? "멈춤" : "실행"}
          </Button>
        )}
        {room && (
          <div className="inline-flex h-8 items-center rounded-lg border bg-background/95 p-[3px]" role="group" aria-label="보는 방법">
            {([["site", "현장", Armchair], ["circuit", "회로", Cable]] as const).map(([id, name, Icon]) => (
              <button key={id} type="button" aria-pressed={mode === id} data-testid={`wiring-3d-mode-${id}`}
                onClick={() => { setMode(id); set({ selected: null, hover: null, step: null }); invalidate(); }}
                title={id === "site" ? "가전 · 가구에 단 모듈로 시뮬레이션해요" : "보드 · 브레드보드 배선만 봐요"}
                className={cn("flex h-full items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50", mode === id && "bg-foreground text-background")}>
                <Icon className="size-3.5" />{name}
              </button>
            ))}
          </div>
        )}
        {!site && assembly && assembly.steps.length > 2 && (
          <Button type="button" size="sm" variant="outline" className={cn("h-8", step !== null ? "border-[#0f2239] bg-[#0f2239] text-white hover:bg-[#0f2239]/90 hover:text-white" : "bg-background/95")} aria-pressed={step !== null} data-testid="wiring-3d-steps" onClick={() => goStep(step === null ? 0 : null)} title="한 단계씩 꽂아 보기">
            <ListOrdered className="size-3.5" />조립 순서
          </Button>
        )}
        {/* 확장 보드 점퍼 5V: 이 배선은 V 줄을 5V 로 쓴다 (평소 3.3V) */}
        {!site && scene.boards[0]?.kind === "expansion" && scene.boards[0].jumper === "5V" && (
          <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-500/60 bg-amber-50 px-2 text-sm font-semibold text-amber-900" title={JUMPER_5V_NOTICE} data-testid="wiring-3d-jumper">
            <Zap className="size-3.5" />점퍼 5V
          </span>
        )}
        {/* 조립 안전: 누르면 안내 카드 */}
        {safety && (
          <Button type="button" size="sm" variant="outline" aria-pressed={safetyOpen} data-testid="wiring-3d-safety" title="조립하기 전에 읽어요"
            className={cn("h-8 font-semibold", safety.level === "danger" ? "border-red-500/60 bg-red-50 text-red-900 hover:bg-red-100" : "border-amber-500/60 bg-amber-50 text-amber-900 hover:bg-amber-100")}
            onClick={() => setSafetyOpen((v) => !v)}>
            {safety.level === "danger" ? <TriangleAlert className="size-3.5" /> : <ShieldAlert className="size-3.5" />}조립 안전
          </Button>
        )}
        {!site && scene.boards.length > 0 && (
          <Button type="button" size="sm" variant="outline" className={cn("h-8", pinout ? "border-[#0f2239] bg-[#0f2239] text-white hover:bg-[#0f2239]/90 hover:text-white" : "bg-background/95")} aria-pressed={pinout} data-testid="wiring-3d-pinout-open" onClick={() => setPinout((v) => !v)} title="보드의 핀마다 무엇을 할 수 있는지 봐요">
            <MapIcon className="size-3.5" />핀 배치도
          </Button>
        )}
        {behavior && has("buzzer") && (
          <Button type="button" size="icon" variant="outline" className="size-8 bg-background/95" aria-pressed={sound} aria-label={sound ? "소리 끄기" : "소리 켜기"} title={sound ? "소리 끄기" : "소리 켜기"} onClick={() => set({ sound: !sound })}>
            {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
        )}
        {toolbar}
      </div>

      {selected && <PartCard />}
      <OledZoom />
      {pinout && <PinoutDialog scene={scene} onClose={() => setPinout(false)} />}
      {safety && safetyOpen && step === null && (
        <div role="note" aria-label="조립 안전 안내" className={cn("absolute top-12 left-2 z-20 w-[min(22rem,calc(100%-1rem))] rounded-xl border px-3 py-2 shadow-[0_4px_0_rgba(15,34,57,0.2)]", SAFETY_TONE[safety.level])} data-testid="wiring-3d-safety-card">
          <SafetyBody safety={safety} compact />
          <div className="mt-2 flex justify-end"><Button type="button" size="sm" variant="outline" className="h-7 bg-white/80" onClick={() => setSafetyOpen(false)}>닫기</Button></div>
        </div>
      )}
      {step !== null && assembly && <StepCard step={step} go={goStep} safety={step === 0 ? safety : null} safetyOk={safetyOk} onSafetyOk={setSafetyOk} />}
      {step === null && <Controls has={has} />}
      {behavior && <SerialMonitor />}
      <Phone />

      {hasSchematic && schematic && step === null && (
        <div className={cn("absolute right-2 bottom-12 z-10 hidden w-72 rounded-xl border bg-white/97 p-2 shadow-[0_3px_0_rgba(15,34,57,0.18)] sm:block", ink)} data-testid="wiring-3d-schematic">
          <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-bold text-[#0f2239]">
            <CircuitBoard className="size-3.5" />회로도
            <button type="button" className="ml-auto rounded p-0.5 text-[#5b6168] outline-none hover:bg-neutral-100 focus-visible:ring-3 focus-visible:ring-ring/60" aria-label="회로도 숨기기" onClick={() => setSchematic(false)}><XIcon className="size-3.5" /></button>
          </div>
          <Schematic scene={scene} />
        </div>
      )}

      {/* 보기 조절 */}
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border bg-background/95 p-1 shadow-sm">
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="왼쪽으로 돌리기 (Q)" title="왼쪽으로 돌리기 (Q) · 마우스 오른쪽 버튼을 누른 채 끌면 360도로 돌아가요" data-testid="wiring-3d-rotate-left" onClick={() => camera?.rotate(-1)}><RotateCcw className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="오른쪽으로 돌리기 (E)" title="오른쪽으로 돌리기 (E) · 마우스 오른쪽 버튼을 누른 채 끌면 360도로 돌아가요" onClick={() => camera?.rotate(1)}><RotateCw className="size-4" /></Button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="작게 (−)" title="작게 (−)" onClick={() => camera?.zoom(1 / 1.25)}><Minus className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="크게 (+)" title="크게 (+)" onClick={() => camera?.zoom(1.25)}><Plus className="size-4" /></Button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        {hasSchematic && <Button type="button" size="icon" variant={schematic ? "secondary" : "ghost"} className={tool} aria-label="회로도" title="회로도" aria-pressed={schematic} data-testid="wiring-3d-schematic-toggle" onClick={() => setSchematic((v) => !v)}><CircuitBoard className="size-4" /></Button>}
        <Button type="button" size="icon" variant={topView ? "secondary" : "ghost"} className={tool} aria-label="위에서 보기" title="위에서 보기" aria-pressed={topView} onClick={() => { set({ topView: !topView }); camera?.top(!topView); }}><Eye className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className={tool} aria-label="처음으로 (R)" title="처음으로 (R)" onClick={() => { camera?.reset(); set({ topView: false }); }}><LocateFixed className="size-4" /></Button>
      </div>
    </div>
  );

  const info = <InfoPanel scene={scene} />;
  if (stage) return <>{canvas}{infoContainer && createPortal(info, infoContainer)}</>;
  return (
    <div className={cn("grid gap-3", large && "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start")}>
      {canvas}
      {info}
    </div>
  );
}

/** WebGL 을 만들지 못하면(오래된 기기 등) 그림으로 돌아가게 알린다 */
class GlBoundary extends Component<{ onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** DOM 자리 등록 (OverlaySync 가 매 화면 옮긴다) */
function nodeRef(dom: ViewerState["dom"], id: string, key: "dot" | "card" | "line") {
  return (el: HTMLElement | SVGLineElement | null) => {
    const cur = dom.nodes.get(id) ?? { dot: null, card: null, line: null };
    dom.nodes.set(id, { ...cur, [key]: el });
  };
}

/** 조립 순서 카드: 지금 단계에서 꽂을 부품과 이을 선. ← → 로 넘긴다 */
function StepCard({ step, go, safety, safetyOk, onSafetyOk }: {
  step: number;
  go: (n: number | null) => void;
  /** 첫 단계에서만: 그 챕터의 조립 안전 안내(없으면 null) */
  safety: ReturnType<typeof chapterSafety>;
  safetyOk: boolean;
  onSafetyOk: (ok: boolean) => void;
}) {
  const assembly = useViewer((s) => s.assembly);
  if (!assembly) return null;
  const { steps } = assembly;
  const cur = steps[step];
  const lead = step === 0 ? "부품을 꽂기 전에 보드와 브레드보드 자리부터 잡아요."
    : !cur.parts.length ? "보드의 전원 핀을 브레드보드 + − 줄에 이어요. 여러 부품이 이 줄을 함께 써요."
    : cur.wires.length ? "주황 빛 자리에 부품을 꽂고, 아래 선을 이어요. 선 끝 고리가 꽂을 자리예요."
    : "주황 빛 자리에 부품을 놓아요.";
  const last = step === steps.length - 1;
  return (
    <div className={cn("absolute bottom-14 left-2 z-10 flex max-h-[calc(100%-7.5rem)] w-[min(20rem,calc(100%-1rem))] flex-col rounded-xl border bg-white text-[#0f2239] shadow-[0_4px_0_rgba(15,34,57,0.2)]", ink)} data-testid="wiring-3d-step" aria-live="polite">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
        <span className="rounded-md bg-[#0f2239] px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">{step + 1} / {steps.length}</span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{cur.title}</p>
        <button type="button" className="-mr-1 rounded-md p-1 text-[#5b6168] outline-none hover:bg-neutral-100 focus-visible:ring-3 focus-visible:ring-ring/60" aria-label="조립 순서 닫기" onClick={() => go(null)}><XIcon className="size-4" /></button>
      </div>
      <div className="min-h-0 overflow-y-auto px-3 py-2">
        {safety && (
          <div className={cn("mb-2 rounded-lg border px-2.5 py-2", SAFETY_TONE[safety.level])} data-testid="wiring-3d-safety-gate" data-level={safety.level}>
            <SafetyBody safety={safety} compact />
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md bg-white/80 px-2 py-1.5 text-sm font-bold">
              <input type="checkbox" className="size-4 accent-[#e8590c]" checked={safetyOk} onChange={(e) => onSafetyOk(e.target.checked)} data-testid="wiring-3d-safety-ok" />
              USB 를 뺐어요. 조심해서 조립할게요
            </label>
          </div>
        )}
        <p className="text-[0.8rem] leading-snug break-keep text-[#5b6168]">{lead}</p>
        {cur.lines.length > 0 && (
          <ul className="mt-2 grid gap-1">
            {cur.lines.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.8rem] leading-snug break-keep">
                <span className="mt-1 h-1.5 w-5 shrink-0 rounded-full shadow-[0_0_0_1px_rgba(15,34,57,0.25)]" style={{ background: l.color }} />
                <span>{l.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-neutral-200 px-2 py-1.5">
        <Button type="button" size="sm" variant="ghost" className="h-8" disabled={step === 0} onClick={() => go(step - 1)} aria-label="이전 단계 (←)"><ChevronLeft className="size-4" />이전</Button>
        <div className="flex min-w-0 flex-1 justify-center gap-1" aria-hidden>
          {steps.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-4 bg-[#e8590c]" : i < step ? "w-1.5 bg-[#0f2239]/60" : "w-1.5 bg-[#0f2239]/15")} />)}
        </div>
        {last
          ? <Button type="button" size="sm" className="h-8" onClick={() => go(null)}>다 꽂았어요</Button>
          : <Button type="button" size="sm" className="h-8" onClick={() => go(step + 1)} disabled={Boolean(safety) && !safetyOk} title={safety && !safetyOk ? "위의 안전 확인을 먼저 눌러요" : undefined} aria-label="다음 단계 (→)" data-testid="wiring-3d-step-next">다음<ChevronRight className="size-4" /></Button>}
      </div>
    </div>
  );
}

/** 누른 부품의 카드: 설명 + (LED) 색 바꾸기 · (저항) 값 바꾸기 */
function PartCard() {
  const selected = useViewer((s) => s.selected);
  const set = useViewer((s) => s.set);
  const ledColor = useViewer((s) => s.ledColor);
  const dim = useViewer((s) => s.dim);
  const dom = useViewer((s) => s.dom);
  const invalidate = useViewer((s) => s.invalidate);
  if (!selected) return null;
  const control = selected.control;
  return (
    <div ref={(el) => { dom.partCard = el; }} className={cn("absolute top-12 left-2 z-10 w-64 rounded-xl border bg-white p-3 text-[#0f2239] shadow-[0_4px_0_rgba(15,34,57,0.2)]", ink)} data-testid="wiring-3d-part">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-bold">{selected.label}</p>
        <button type="button" className="-mt-1 -mr-1 rounded-md p-1 text-[#5b6168] outline-none hover:bg-neutral-100 focus-visible:ring-3 focus-visible:ring-ring/60" aria-label="부품 카드 닫기" onClick={() => { set({ selected: null }); invalidate(); }}><XIcon className="size-4" /></button>
      </div>
      <p className="mt-1 text-[0.8rem] leading-snug break-keep text-[#5b6168]">{selected.text}</p>
      {control?.type === "led" && (
        <div className="mt-3 border-t border-neutral-200 pt-2.5">
          <p className="text-xs font-semibold">색 바꿔 보기</p>
          <div className="mt-1.5 flex gap-2">
            {LED_COLORS.map(([name, color]) => (
              <button key={color} type="button" aria-label={name} title={name} aria-pressed={ledColor[control.part] === color}
                onClick={() => { set({ ledColor: { ...ledColor, [control.part]: color } }); invalidate(); }}
                className={cn("size-7 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(15,34,57,0.5)] outline-none focus-visible:ring-3 focus-visible:ring-ring/60", ledColor[control.part] === color && "shadow-[0_0_0_2.5px_#0f2239]")} style={{ background: color }} />
            ))}
          </div>
        </div>
      )}
      {control?.type === "resistor" && (
        <div className="mt-3 border-t border-neutral-200 pt-2.5">
          <p className="text-xs font-semibold">다른 값으로 바꿔 보기</p>
          <div className="mt-1.5 flex gap-1.5">
            {OHMS.map(([name, f]) => (
              <button key={name} type="button" aria-pressed={dim === f} onClick={() => { set({ dim: f }); invalidate(); }}
                className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/60", dim === f ? "border-[#0f2239] bg-[#0f2239] text-white" : "border-neutral-300 hover:bg-neutral-100")}>{name}</button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.72rem] leading-snug break-keep text-[#5b6168]">값이 클수록 길이 좁아져 전기가 적게 흐르고, LED 가 어두워져요. 실행해서 확인해 보세요.</p>
        </div>
      )}
    </div>
  );
}

/** 3D 로 바로 만지기 어려운 입력 (주변 밝기 · 온도 · 습도) 은 작은 조절판으로 */
function Controls({ has }: { has: (k: Device["kind"]) => boolean }) {
  const sim = useViewer((s) => s.sim);
  const invalidate = useViewer((s) => s.invalidate);
  const [, bump] = useState(0);
  if (!sim) return null;
  const light = has("photo"), dht = has("dht");
  if (!light && !dht) return null;
  const i = sim.inputs;
  const slider = (label: string, icon: ReactNode, value: number, min: number, max: number, unit: string, onChange: (v: number) => void) => (
    <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#0f2239]">
      {icon}<span className="w-8 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} aria-label={label} onChange={(e) => { onChange(Number(e.target.value)); bump((n) => n + 1); invalidate(); }} className="h-1.5 w-0 min-w-0 flex-1 accent-[#e8590c]" />
      <span className="w-11 shrink-0 text-right tabular-nums">{value}{unit}</span>
    </label>
  );
  return (
    <div className={cn("absolute top-12 right-2 z-10 grid w-64 grid-cols-[minmax(0,1fr)] gap-2 rounded-xl border bg-white/97 p-2.5 shadow-[0_3px_0_rgba(15,34,57,0.18)]", ink)} data-testid="wiring-3d-controls">
      {light && slider("빛", <Sun className="size-3.5 text-amber-500" />, Math.round(i.light * 100), 0, 100, "%", (v) => { i.light = v / 100; })}
      {light && <p className="-mt-1 flex items-center gap-1 text-[0.7rem] break-keep text-[#5b6168]"><Hand className="size-3" />빛 센서를 누르면 손으로 가려요</p>}
      {dht && slider("온도", <Thermometer className="size-3.5 text-red-500" />, i.temp, 0, 45, "°C", (v) => { i.temp = v; })}
      {dht && slider("습도", <span className="w-3.5 text-center text-[0.65rem] font-bold text-sky-500">%</span>, i.humidity, 10, 95, "%", (v) => { i.humidity = v; })}
    </div>
  );
}

/** 시리얼 모니터: 실행 중에 보드가 읽은 센서 값과 print() 줄 */
function SerialMonitor() {
  const running = useViewer((s) => s.running);
  const readings = useViewer((s) => s.readings);
  const serial = useViewer((s) => s.serial);
  if (!running) return null;
  return (
    <div className={cn("absolute bottom-14 left-2 z-10 w-64 overflow-hidden rounded-xl border bg-[#fffcf8]/97 shadow-[0_3px_0_rgba(15,34,57,0.18)]", ink)} data-testid="wiring-3d-serial">
      <p className="flex items-center gap-1.5 border-b border-neutral-200 px-2.5 py-1 text-xs font-bold text-[#0f2239]"><span className="size-2 animate-pulse rounded-full bg-emerald-500" />시리얼 모니터 · 실행 중</p>
      {readings.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 border-b border-neutral-200 px-2.5 py-1.5 text-xs">
          {readings.map(([k, v]) => <div key={k} className="contents"><dt className="text-[#5b6168]">{k}</dt><dd className="text-right font-mono font-semibold text-[#0f2239]">{v}</dd></div>)}
        </dl>
      )}
      <pre className="max-h-24 overflow-hidden px-2.5 py-1.5 font-mono text-[0.72rem] leading-snug text-[#0f2239]">{serial.slice(-5).join("\n") || " "}</pre>
    </div>
  );
}

/** 폰 (WiFi 챕터): 보드의 웹서버가 보여 주는 페이지. 단추를 누르면 그 주소로 요청이 간다 */
function Phone() {
  const running = useViewer((s) => s.running);
  const phone = useViewer((s) => s.phone);
  const sim = useViewer((s) => s.sim);
  const invalidate = useViewer((s) => s.invalidate);
  if (!running || !phone || !sim) return null;
  return (
    <div className="absolute right-3 bottom-14 z-10 w-44 rounded-[1.6rem] border-[5px] border-[#212529] bg-white p-2 pt-4 shadow-[0_6px_0_rgba(15,34,57,0.25)]" data-testid="wiring-3d-phone">
      <span className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-[#212529]" aria-hidden />
      <p className="truncate rounded-md bg-neutral-100 px-2 py-0.5 text-[0.65rem] text-[#5b6168]">192.168.4.1</p>
      <p className="mt-1.5 text-center text-sm font-bold text-[#0f2239]">{phone.title}</p>
      <div className="mt-1.5 grid gap-1.5">
        {phone.buttons.map((b) => (
          <button key={b.path} type="button" onClick={() => { sim.inputs.web.push(b.path); invalidate(); }}
            className="rounded-lg bg-[#1c7ed6] px-2 py-1.5 text-xs font-bold text-white outline-none hover:bg-[#1971c2] focus-visible:ring-3 focus-visible:ring-ring/60">{b.label}</button>
        ))}
      </div>
      {phone.lines.length > 0 && <ul className="mt-1.5 space-y-0.5 text-center text-xs text-[#0f2239]">{phone.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
    </div>
  );
}

/** 연결 목록 (작업대의 배선 탭) */
function InfoPanel({ scene }: { scene: Scene3D }) {
  const picked = useViewer((s) => s.picked);
  const set = useViewer((s) => s.set);
  const invalidate = useViewer((s) => s.invalidate);
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-sm font-semibold">{scene.title || "이렇게 꽂아요"}</p>
        {picked && <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 text-muted-foreground" onClick={() => { set({ picked: null }); invalidate(); }}><RotateCcw className="size-3.5" />모든 선 보기</Button>}
      </div>
      <ul className="grid gap-1.5">
        {scene.rows.map((row, i) => {
          const on = row.colors.includes(picked ?? "");
          return (
            <li key={i}>
              <button type="button" aria-pressed={on}
                onClick={() => { set({ picked: on ? null : row.colors[0], selected: null }); invalidate(); }}
                onMouseEnter={() => { set({ preview: row.colors[0] }); invalidate(); }}
                onMouseLeave={() => { set({ preview: null }); invalidate(); }}
                className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none", on && "border-primary bg-primary/5", picked && !on && "opacity-60")}>
                <span className="flex shrink-0 flex-col gap-0.5 rounded bg-muted p-1">{row.colors.map((c) => <span key={c} className="block h-1.5 w-6 rounded-full" style={{ background: c }} />)}</span>
                <span className="min-w-0"><b className="font-semibold">{row.part}</b> → {row.to}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-muted-foreground">줄을 누르면 그 선만 또렷하게 보여요.</p>
    </div>
  );
}

/** 부저 소리: 실행 중 · 소리 켬일 때 부저 핀의 음 높이로 소리를 낸다 (능동 부저는 2.3kHz) */
function useBuzzerSound(on: boolean) {
  const sim = useViewer((s) => s.sim);
  const devices = useViewer((s) => s.devices);
  useEffect(() => {
    if (!on || !sim) return;
    const buzzers = devices.filter((d): d is Extract<Device, { kind: "buzzer" }> => d.kind === "buzzer");
    if (!buzzers.length) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    const id = window.setInterval(() => {
      let hz = 0;
      for (const d of buzzers) {
        const t = sim.outputs.tone[d.pin] ?? 0;
        if (t > 0) hz = t;
        else if (d.active && (sim.outputs.pins[d.pin] ?? 0) > 0.5) hz = 2300;
      }
      if (hz > 0) osc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.005);
      gain.gain.setTargetAtTime(hz > 0 ? 0.05 : 0, ctx.currentTime, 0.01);
    }, 30);
    return () => { window.clearInterval(id); osc.stop(); void ctx.close(); };
  }, [on, sim, devices]);
}
