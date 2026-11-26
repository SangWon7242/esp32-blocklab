import { useEffect, useRef } from "react";

/*
 * 「펌웨어 설치」 창을 어디서든 연다 (보드 연결이 "대답하지 않아요" 로 실패했을 때 알림의 단추 등).
 * 창을 품은 곳(챕터 화면의 단추, 편집기)이 마운트되면 여는 함수를 올려 두고, 가장 나중에 올린 곳이 연다.
 */
const openers: Array<() => void> = [];

/** 펌웨어 설치 창을 연다. 열 곳이 없으면 false */
export function requestFirmwareInstall(): boolean {
  const open = openers.at(-1);
  if (!open) return false;
  open();
  return true;
}

/** 열 곳이 있는가 (알림에 단추를 붙일지) */
export function canRequestFirmwareInstall(): boolean {
  return openers.length > 0;
}

/** 이 컴포넌트가 펌웨어 창을 연다 */
export function useFirmwareOpener(open: () => void): void {
  const ref = useRef(open);
  ref.current = open;
  useEffect(() => {
    const opener = () => ref.current();
    openers.push(opener);
    return () => {
      const i = openers.lastIndexOf(opener);
      if (i >= 0) openers.splice(i, 1);
    };
  }, []);
}
