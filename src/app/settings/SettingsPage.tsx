import { useRef } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_MODEL } from "@/ai/claude";
import { useHost } from "@/host/HostContext";
import { reloadProgress } from "../track/progressState";
import { updateSettings, useLocalSettings } from "./localSettings";

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

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** #/settings (체험판 전용) — 교사 모드·가짜 보드·진행 기록 내보내기/불러오기/초기화. 설정은 localStorage, 기록은 호스트 저장소 */
export function SettingsPage() {
  const settings = useLocalSettings();
  const { store: progressStore } = useHost();
  // LocalProgressStore 가 "저장이 막혔다"고 밝힌 경우만 경고한다 (다른 저장소는 영구 저장으로 본다)
  const persistent = (progressStore as { persistent?: boolean }).persistent !== false;
  const fileRef = useRef<HTMLInputElement>(null);

  const exportProgress = async () => {
    try {
      const text = await progressStore.exportJson();
      const date = new Date().toISOString().slice(0, 10);
      downloadText(`esp32-blocklab-기록-${date}.json`, text);
    } catch (e) {
      toast.error(`내보내지 못했어요: ${message(e)}`);
    }
  };

  const importProgress = async (file: File | undefined) => {
    if (!file) return;
    try {
      await progressStore.importJson(await file.text());
      await reloadProgress(progressStore);
      toast.success("진행 기록을 불러왔어요");
    } catch (e) {
      toast.error(`불러오지 못했어요: ${message(e)}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const resetProgress = async () => {
    try {
      await progressStore.clear();
      await reloadProgress(progressStore);
      toast.success("진행 기록을 지웠어요");
    } catch (e) {
      toast.error(`지우지 못했어요: ${message(e)}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-sm text-muted-foreground">
          {persistent
            ? "이 설정과 진행 기록은 이 브라우저에만 저장됩니다."
            : "이 브라우저는 저장이 막혀 있어 설정과 진행 기록이 새로 고치면 사라집니다. 내보내기로 파일에 남겨 두세요."}
        </p>

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
                <Label htmlFor="explain-gate">미션은 교사 확인 뒤 완료</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  미션·디버깅은 판정을 통과한 뒤 선생님께 1분 설명을 하고 "설명 확인"을 받아야 완료됩니다. 확인 버튼은 교사 모드에서 보여요.
                </p>
              </div>
              <Switch id="explain-gate" checked={settings.explainGate} onCheckedChange={(v) => updateSettings({ explainGate: v })} />
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
            <CardTitle>AI 점검</CardTitle>
            <CardDescription>
              키를 넣으면 성찰 단계의 "내 설명 점검 받기"와 디버깅 단계의 "질문 3개만 받기"가 보입니다.
              키는 이 브라우저에만 저장되고, 이 브라우저에서 Claude API 로 바로 보냅니다. 공용 컴퓨터에서는 수업이 끝나면 지워 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claude-key">교사용 Claude API 키</Label>
              <Input
                id="claude-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-..."
                value={settings.claudeApiKey}
                onChange={(e) => updateSettings({ claudeApiKey: e.target.value.trim() })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claude-model">모델</Label>
              <Input
                id="claude-model"
                spellCheck={false}
                value={settings.claudeModel}
                onChange={(e) => updateSettings({ claudeModel: e.target.value })}
                onBlur={(e) => { if (!e.target.value.trim()) updateSettings({ claudeModel: DEFAULT_MODEL }); }}
              />
              <p className="text-xs text-muted-foreground">기본값 {DEFAULT_MODEL}</p>
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
