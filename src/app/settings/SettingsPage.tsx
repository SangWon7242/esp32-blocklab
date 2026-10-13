import { useRef } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { progressStore, reloadProgress } from "../track/progressState";
import { updateSettings, useSettings } from "./settings";

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** #/settings — 교사 모드·가짜 보드·진행 기록 내보내기/불러오기/초기화 */
export function SettingsPage() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportProgress = async () => {
    const text = await progressStore.exportJson();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(`esp32-blocklab-기록-${date}.json`, text);
  };

  const importProgress = async (file: File | undefined) => {
    if (!file) return;
    try {
      await progressStore.importJson(await file.text());
      await reloadProgress();
      toast.success("진행 기록을 불러왔어요");
    } catch (e) {
      toast.error(`불러오지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const resetProgress = async () => {
    await progressStore.clear();
    await reloadProgress();
    toast.success("진행 기록을 지웠어요");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-sm text-muted-foreground">이 설정과 진행 기록은 이 브라우저에만 저장됩니다.</p>

        <Card>
          <CardHeader>
            <CardTitle>모드</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="teacher-mode">교사 모드</Label>
                <p className="mt-1 text-sm text-muted-foreground">모든 단계를 열고, 예시 답과 정답을 바로 보여 줍니다.</p>
              </div>
              <Switch id="teacher-mode" checked={settings.teacherMode} onCheckedChange={(v) => updateSettings({ teacherMode: v })} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="fake-board">가짜 보드</Label>
                <p className="mt-1 text-sm text-muted-foreground">보드가 없어도 자유 코딩에서 실행해 볼 수 있게 가짜 장치를 씁니다. 자유 코딩 화면을 다시 열면 적용돼요.</p>
              </div>
              <Switch id="fake-board" checked={settings.fakeBoard} onCheckedChange={(v) => updateSettings({ fakeBoard: v })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>진행 기록</CardTitle>
            <CardDescription>다른 컴퓨터로 옮기거나 선생님께 낼 때 파일로 내보내고 불러옵니다.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void exportProgress()}><Download className="size-4" />내보내기</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" />불러오기</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="import-file"
              onChange={(e) => void importProgress(e.target.files?.[0])}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><RotateCcw className="size-4" />초기화</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>진행 기록을 모두 지울까요?</AlertDialogTitle>
                  <AlertDialogDescription>모든 챕터의 단계 기록과 적은 글이 사라지고 되돌릴 수 없어요. 먼저 내보내기로 저장해 두면 나중에 불러올 수 있어요.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void resetProgress()}>지우기</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
