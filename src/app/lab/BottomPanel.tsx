import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type BottomTab = "problems" | "console";

type Props = {
  open: boolean;
  onToggle(): void;
  /** 탭 내용 (`TabsContent value="problems" | "console"`). 없으면 빈 안내를 보여 준다 */
  children?: ReactNode;
};

function Empty({ value }: { value: BottomTab }) {
  return (
    <TabsContent value={value} className="px-3 py-2 text-sm text-muted-foreground">
      아직 메시지가 없어요
    </TabsContent>
  );
}

/** 편집기 아래의 접을 수 있는 패널. 문제·콘솔 탭은 다음 단계(검사 엔진·보드 연결)가 채운다 */
export function BottomPanel({ open, onToggle, children }: Props) {
  const [tab, setTab] = useState<BottomTab>("problems");
  const onTabChange = (value: string) => {
    setTab(value as BottomTab);
    // 접힌 채로 탭을 누르면 그 탭을 보려는 것이므로 펼친다
    if (!open) onToggle();
  };

  return (
    <Tabs
      value={tab}
      onValueChange={onTabChange}
      className={cn("shrink-0 gap-0 border-t", open ? "h-40" : "h-8")}
      data-testid="bottom-panel"
    >
      <div className="flex h-8 shrink-0 items-center gap-2 px-2">
        <TabsList variant="line" className="h-7">
          <TabsTrigger value="problems" className="px-2 text-xs">문제</TabsTrigger>
          <TabsTrigger value="console" className="px-2 text-xs">콘솔</TabsTrigger>
        </TabsList>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          aria-label={open ? "하단 패널 접기" : "하단 패널 펼치기"}
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </Button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-auto", !open && "hidden")}>
        {children ?? (
          <>
            <Empty value="problems" />
            <Empty value="console" />
          </>
        )}
      </div>
    </Tabs>
  );
}
