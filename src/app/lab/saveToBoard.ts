import { DeviceError, fetchLibFiles, type Device } from "@/device";
import { libFilesForProgram } from "@/devices/registry";

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

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

/**
 * 프로그램에 필요한 라이브러리(public/lib)를 보드와 맞춘다: 없거나 크기가 다른(옛 판) 것만 올린다.
 * 크기 비교는 Keyestudio 판 ssd1306.py(line/rect 없음)가 이미 든 보드에 새 판을 올리기 위한 것이다.
 * 실행 전에도 부르므로(실행은 main.py 를 쓰지 않는다) 라이브러리가 없는 보드에서 ImportError 가 나지 않는다.
 */
export async function syncLibs(
  device: Device,
  program: DeviceProgram,
  log: (text: string) => void,
  fetchLibs: typeof fetchLibFiles = fetchLibFiles,
): Promise<void> {
  const libs = libFilesForProgram(program);
  if (libs.length === 0) return;
  const files = await fetchLibs(libs);
  const sizes = await onBoard(() => device.fileSizes());
  for (const f of files) {
    const onBoardSize = sizes[f.name];
    if (onBoardSize === undefined) log(`${f.name} 올리는 중…`);
    else if (onBoardSize !== utf8Length(f.text)) log(`${f.name} 새 판으로 바꾸는 중…`);
    else continue;
    await onBoard(() => device.saveFile(f.name, f.text));
  }
}

/**
 * 보드에 저장: 라이브러리를 맞춘 뒤(syncLibs) → main.py → 소프트 리셋(main.py 가 바로 돈다).
 * 진행은 log 로 한 줄씩 (콘솔 system 행). 실패하면 그 자리에서 멈추고 오류를 던진다.
 */
export async function saveToBoard(
  device: Device,
  program: DeviceProgram,
  log: (text: string) => void,
  fetchLibs: typeof fetchLibFiles = fetchLibFiles,
): Promise<void> {
  await syncLibs(device, program, log, fetchLibs);
  log("main.py 올리는 중…");
  await onBoard(() => device.saveFile("main.py", program.code));
  log("main.py 저장 완료");
  await device.softReset();
  log("보드를 다시 시작했어요 (main.py 가 실행돼요)");
}
