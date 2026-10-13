import { Component, type ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 화면 하나가 그리다 throw 해도(지연 로딩 실패 포함) 흰 화면 대신 안내와 새로 고침 버튼을 보인다 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <div className="flex flex-col items-start gap-3 p-8" role="alert">
        <p>화면을 그리다 문제가 생겼어요. 새로 고쳐 주세요</p>
        <Button onClick={() => window.location.reload()}><RotateCw className="size-4" />새로 고침</Button>
      </div>
    );
  }
}
