import { DeviceError, fetchLibFiles, type Device } from "@/device";
import { libFilesFor } from "@/devices/registry";

/** 실행·저장할 프로그램: 코드 패널의 코드와 그 코드의 블록 종류 (라이브러리 고르기용) */
export type DeviceProgram = { code: string; blockTypes: string[] };

/** 보드 쪽 실패(파일 쓰기 OSError, 멈춤 등)를 학생 문구로. 장치 오류(끊김·시간 초과)는 이미 학생 문구라 그대로 */
async function onBoard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof DeviceError) throw e;
    throw new Error(`보드에 저장하지 못했어요: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
}

/**
 * 보드에 저장: 쓰인 준비 블록의 라이브러리(public/lib) 중 보드에 없는 것만 올리고 → main.py → 소프트 리셋(main.py 가 바로 돈다).
 * 진행은 log 로 한 줄씩 (콘솔 system 행). 실패하면 그 자리에서 멈추고 오류를 던진다.
 */
export async function saveToBoard(
  device: Device,
  { code, blockTypes }: DeviceProgram,
  log: (text: string) => void,
  fetchLibs: typeof fetchLibFiles = fetchLibFiles,
): Promise<void> {
  const libs = libFilesFor(blockTypes);
  if (libs.length > 0) {
    const present = new Set(await onBoard(() => device.listFiles()));
    const missing = libs.filter((name) => !present.has(name));
    if (missing.length > 0) {
      for (const f of await fetchLibs(missing)) {
        log(`${f.name} 올리는 중…`);
        await onBoard(() => device.saveFile(f.name, f.text));
      }
    }
  }
  log("main.py 올리는 중…");
  await onBoard(() => device.saveFile("main.py", code));
  log("main.py 저장 완료");
  await device.softReset();
  log("보드를 다시 시작했어요 (main.py 가 실행돼요)");
}
