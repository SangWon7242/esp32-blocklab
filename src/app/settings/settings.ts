import { useHost, type SettingsSource } from "@/host/HostContext";

export type { SettingsSource };

/** 설정은 호스트가 정한다 (허브: 관리자=teacherMode, 학생=설정 표 값. 체험판: localStorage, App.tsx 의 어댑터) */
export function useSettings(): SettingsSource {
  return useHost().settings;
}
