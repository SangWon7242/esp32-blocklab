/**
 * 코드 패널이 onChange 로 보낸 글을 기억한다. 부모 상태는 debounce 때문에 편집기보다 늦게 따라오므로,
 * value 로 돌아온 글이 편집기가 보냈던 글이면(그 사이 더 쳤더라도) 문서를 덮어쓰지 않아야 입력이 사라지지 않는다.
 */
export function createEchoGuard() {
  let sent: string[] = [];
  return {
    emitted(text: string): void {
      sent.push(text);
    },
    /** 메아리면 그때까지 보낸 기록을 정리하고 true. 아니면(바깥에서 바꾼 글) 기록을 비우고 false */
    isEcho(value: string): boolean {
      const at = sent.lastIndexOf(value);
      if (at < 0) {
        sent = [];
        return false;
      }
      sent = sent.slice(at + 1);
      return true;
    },
    /** 편집기가 더는 기준이 아닐 때(읽기 전용) 기록을 버린다 */
    reset(): void {
      sent = [];
    },
  };
}
