import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Box, Image as ImageIcon, Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BoardId } from "@/track/board";
import { canShow3D, hasScene3D } from "@/track/wiring3d";
import { BOARD_IDS, useBoardChoice } from "../board/boardChoice";
import { Illustration, JumperNotice, resolveBoardImage, shownJumperNotice } from "./Illustration";
import { SafetyNotice } from "./SafetyNotice";
import { useScene3D } from "./useScene3D";

// three.js 는 3D 탭을 처음 열 때만 불러온다
const Wiring3DView = lazy(() => import("./wiring3d/Wiring3DView").then((m) => ({ default: m.Wiring3DView })));

type Props = { chapterId: string; image: string; caption?: string; className?: string; board?: BoardId };

function Loading() {
  return (
    <div className="flex aspect-[4/3] max-h-[70dvh] w-full items-center justify-center gap-2 rounded-lg bg-muted/40 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />3D 배선을 준비하고 있어요
    </div>
  );
}

/**
 * 배선도: 그림(SVG)과, 3D 장면이 있는 챕터는 「3D 로 보기」 탭까지.
 * 3D 장면이 없거나 기기가 WebGL 을 못 쓰면 그림만 보인다.
 */
export function WiringFigure({ chapterId, image, caption, className, board: boardProp }: Props) {
  const chosen = useBoardChoice();
  const board = boardProp ?? chosen;
  const shown = resolveBoardImage(chapterId, image, board);
  const [tab, setTab] = useState("picture");
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => { if (!canShow3D()) setUnsupported(true); }, []);
  const has3d = hasScene3D(chapterId, shown) && !unsupported;

  // 보드를 바꿔도 3D 보기는 그대로 두고 장면만 바꾼다 (다른 보드 장면은 한가할 때 미리)
  const { scene, pending } = useScene3D(chapterId, shown, { enabled: tab === "3d" && has3d, siblings: BOARD_IDS.map((b) => resolveBoardImage(chapterId, image, b)) });

  const onUnsupported = useCallback(() => { setUnsupported(true); setTab("picture"); }, []);
  const jumper = shownJumperNotice(chapterId, shown);
  const picture = <Illustration chapterId={chapterId} image={image} caption={caption} className={className} board={boardProp} zoomable showJumper={!has3d} />;
  // 조립 안전 안내(과열 · 고장 · 다칠 수 있는 챕터만): 배선하기 전에 먼저 보이게 맨 위에
  const safety = <SafetyNotice chapterId={chapterId} className="mb-2" />;
  if (!has3d) return <>{safety}{picture}</>;

  return (
    <Tabs value={tab} onValueChange={setTab} data-testid="wiring-figure">
      {safety}
      {/* 확장 보드 점퍼 5V 안내: 그림 · 3D 어느 쪽을 보든 한 번 */}
      {jumper && <JumperNotice text={jumper} />}
      <TabsList>
        <TabsTrigger value="picture"><ImageIcon className="size-4" />그림</TabsTrigger>
        <TabsTrigger value="3d" data-testid="wiring-3d-tab"><Box className="size-4" />3D 로 보기</TabsTrigger>
      </TabsList>
      <TabsContent value="picture">{picture}</TabsContent>
      <TabsContent value="3d">
        {scene ? (
          <Suspense fallback={<Loading />}>
            <Wiring3DView
              scene={scene}
              pending={pending}
              chapterId={chapterId}
              onUnsupported={onUnsupported}
              toolbar={
                <Dialog>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="h-8 bg-background/90" data-testid="wiring-3d-zoom">
                      <Maximize2 className="size-3.5" />크게 보기
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[min(80rem,calc(100vw-4rem))]" data-testid="wiring-3d-dialog">
                    <DialogTitle>3D 배선 보기</DialogTitle>
                    <DialogDescription className="sr-only">배선을 3D 로 크게 보여 줍니다. Esc 를 누르면 닫혀요.</DialogDescription>
                    <Wiring3DView scene={scene} chapterId={chapterId} large />
                  </DialogContent>
                </Dialog>
              }
            />
          </Suspense>
        ) : <Loading />}
      </TabsContent>
    </Tabs>
  );
}
