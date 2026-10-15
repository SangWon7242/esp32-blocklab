import { Link } from "react-router";
import { ArrowRight, Blocks, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">블록으로 만들고, 코드로 읽는 ESP32</h1>
      <p className="mt-2 text-muted-foreground">
        블록을 놓으면 MicroPython 코드가 바로 바뀌고, 코드를 고치면 블록이 따라옵니다.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Blocks className="size-5" />자유 코딩</CardTitle>
            <CardDescription>블록과 코드를 나란히 놓고 바로 써 봅니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link to="/lab">열기 <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RouteIcon className="size-5" />트랙</CardTitle>
            <CardDescription>센서 트랙과 교과 융합 트랙의 챕터를 단계별로 풀어 갑니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link to="/track">열기 <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
