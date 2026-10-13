# ESP32 블록랩 — 계획 2C: 보드 연결 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome의 Web Serial로 ESP32(MicroPython)에 연결해 현재 코드를 실행·저장·멈춤하고, 보드 출력과 Traceback을 콘솔에 영어 그대로 보여 주며 오류 줄을 코드·블록에 강조한다. 보드 없이도 가짜 장치로 같은 흐름을 쓸 수 있다.

**Architecture:** `src/device/`에 `Device` 인터페이스와 두 구현(`WebSerialDevice`: Web Serial + MicroPython raw REPL, `FakeDevice`: 미리 정한 출력), raw REPL 프로토콜은 전송 계층과 분리한 순수 상태 기계(`RawRepl`)로 두어 가짜 전송으로 단위 테스트한다. 화면은 상단 보드 버튼(연결·실행·보드에 저장·멈춤)과 상태 배지, 콘솔 패널에 보드 출력 행을 덧붙이고, `Traceback … line N`을 잡아 코드 줄·블록을 강조한다. "보드에 저장"은 레지스트리 `libFilesFor`로 필요한 라이브러리를 `public/lib/`에서 읽어 함께 올린다.

**Tech Stack:** 계획 2B와 같음. 새 의존성 없음(Web Serial은 브라우저 API).

**Spec:** 기준 문서 7장 + `2026-10-13-plan2-sensors-lint-device-design.md` 4장.

## Global Constraints

- lucide 아이콘만, 이모지 금지, shadcn만, 한국어 학생 문구(오류 안내는 기준 문서 7장 문구), 영어 식별자.
- `src/device`는 React·Blockly 비의존. `RawRepl`은 DOM 비의존(순수 상태 기계 + `Transport` 인터페이스).
- 기존 테스트 기대값 불변. 커밋마다 `npm test`·`npm run build`, 마지막에 `npm run test:e2e`, 푸시, Pages 배포 확인.
- 실제 보드 검증은 사용자가 보드를 꽂은 뒤 컨트롤러가 Chrome에서 직접 수행한다(이 계획의 Task 3). 보드가 없으면 Task 3은 "보드 검증 대기"로 남긴다.

## 사전 확인된 사실

- MicroPython raw REPL 절차(ViperIDE·mpremote와 같음): `\x03\x03`(실행 중단) → `\x01`(raw 모드; 보드가 `raw REPL; CTRL-B to exit\r\n>` 출력) → 코드 전송(256바이트 단위) → `\x04` → 보드가 `OK` 출력 후 프로그램 출력 스트리밍 → 정상 종료 시 `\x04\x04>`, 예외 시 출력 뒤 `\x04` + Traceback 텍스트 + `\x04>` → `\x02`로 일반 REPL 복귀. 소프트 리셋은 일반 REPL에서 `\x04`. 파일 쓰기는 raw REPL에서 `f = open('main.py', 'w')` / `f.write(...)`(청크를 `repr`로) / `f.close()`를 실행하는 방식. `os.listdir()` 결과로 라이브러리 존재 확인.
- Web Serial: `navigator.serial.requestPort()` → `port.open({ baudRate: 115200 })` → `port.readable.getReader()` / `port.writable.getWriter()`; 읽기는 `Uint8Array` 스트림을 `TextDecoder('utf-8', { stream: true })`로 모은다. 연결 끊김은 `navigator.serial` `disconnect` 이벤트. Chrome만 지원(`"serial" in navigator`).
- 현재 UI: `src/app/lab/LabPage.tsx`의 `DEVICE_BUTTONS`(비활성, 툴팁 "보드 연결은 다음 단계에서 들어옵니다"), `src/app/lab/ConsolePanel.tsx`의 `entries: ConsoleEntry[]`(`{level, text, line?, blockId?}`), `useLint`의 `reveal`/`highlightFor`로 줄·블록 강조, `BottomPanel` 탭 `problems|console`. `src/devices/registry.ts`의 `libFilesFor(blockTypes)`, 라이브러리는 `public/lib/*.py`(배포 시 `import.meta.env.BASE_URL + "lib/" + name`로 fetch).
- 수업 저장소 코드는 `main.py`로 올려 실행한다(학생용 안내서가 PyCharm `main.py` 기준).

## 파일 구조

```
src/device/types.ts        Device, DeviceStatus, Transport, OutputEvent 타입
src/device/rawRepl.ts      RawRepl: Transport 위의 raw REPL 상태 기계 (enterRaw, exec(code) → {output, error}, writeFile, softReset, interrupt)
src/device/webSerial.ts    WebSerialTransport + WebSerialDevice
src/device/fake.ts         FakeTransport(스크립트된 응답) + FakeDevice
src/device/traceback.ts    MicroPython Traceback 파싱 → { line, message } (마지막 `File "<stdin>", line N` 또는 `main.py`)
src/device/libs.ts         fetchLibFiles(names) (public/lib 에서 읽기)
src/device/*.test.ts       rawRepl(가짜 전송), traceback, fake device
src/app/lab/useDevice.ts   연결·실행·저장·멈춤 상태와 콘솔 행 생성, Traceback → reveal
src/app/lab/DeviceBar.tsx  상단 버튼 4개 + 상태 배지 (끊김/연결됨/실행 중/저장 중)
src/app/lab/LabPage.tsx    DeviceBar·useDevice 연결, ConsolePanel entries 합치기
e2e/device.spec.ts         ?device=fake 로 가짜 장치 e2e
```

---

### Task 1: 장치 계층 (raw REPL 상태 기계, Web Serial, 가짜 장치, Traceback 파서)

**Interfaces:**
```ts
export type DeviceStatus = "disconnected" | "connecting" | "connected" | "running" | "saving";
export type OutputEvent = { kind: "stdout" | "stderr" | "system"; text: string };
export interface Transport { write(data: Uint8Array | string): Promise<void>; read(): AsyncIterable<string>; close(): Promise<void>; onDisconnect(cb: () => void): void; }
export interface Device {
  readonly status: DeviceStatus;
  onStatus(cb: (s: DeviceStatus) => void): () => void;
  onOutput(cb: (e: OutputEvent) => void): () => void;
  connect(): Promise<void>;             // Web Serial 포트 선택 + open + raw REPL 확인
  disconnect(): Promise<void>;
  run(code: string): Promise<RunResult>;      // raw REPL 실행, 출력은 onOutput 으로 스트리밍
  saveFile(path: string, text: string): Promise<void>;
  listFiles(): Promise<string[]>;
  stop(): Promise<void>;                // Ctrl-C ×2
  softReset(): Promise<void>;
}
export type RunResult = { ok: boolean; error?: { line: number | null; message: string; traceback: string } };
export function parseTraceback(text: string): { line: number | null; message: string } | null;
```
- [ ] 테스트(가짜 전송으로): `RawRepl.enterRaw()`가 `\x03\x03\x01`을 보내고 `raw REPL; CTRL-B to exit\r\n>`을 기다린다; `exec("print(1)")`이 코드+`\x04`를 보내고 `OK1\r\n\x04\x04>`에서 출력 `1\r\n`과 `ok: true`; 예외 응답 `OK\x04Traceback (most recent call last):\r\n  File "<stdin>", line 3, in <module>\r\nNameError: name 'd' isn't defined\r\n\x04>` → `ok: false, error.line 3, message "NameError: name 'd' isn't defined"`; `writeFile("main.py", "a\nb")`가 `open`/`write`/`close`를 실행하고 `listFiles()`가 `os.listdir()` 결과를 배열로 돌려준다; 시간 초과(응답 없음 3초) → 오류 메시지 "코드가 지금 무엇을 기다리고 있을까요? 멈춤을 눌러 보세요"; `stop()`이 `\x03\x03`를 보낸다. `parseTraceback`: `main.py` 꼴과 `<stdin>` 꼴, 중첩 호출(마지막 `File` 줄의 line) 처리. `FakeDevice`: `run(code)`가 코드의 `print(...)` 줄마다 미리 정한 값(기본: 숫자 인자는 그대로, `get_distance()`는 23)을 출력하고, `raise`가 있으면 Traceback을 흉내 낸다; 상태 전이 `connecting → connected → running → connected`.
- [ ] 구현. `WebSerialTransport`는 `navigator.serial` 없으면 `connect()`에서 `DeviceError("unsupported")`(화면 문구 "Chrome에서 열어 주세요"), `requestPort` 취소 → `"cancelled"`, `open` 실패(다른 프로그램 사용 중) → `"busy"`("다른 프로그램(PyCharm 등)이 보드를 쓰고 있어요").
- [ ] 커밋 "장치 계층: raw REPL 상태 기계, Web Serial, 가짜 장치, Traceback 파서".

### Task 2: 화면 연결

- [ ] `useDevice(getCode, usedBlockTypes, reveal)`: 장치 선택(`?device=fake` 또는 설정 토글 → FakeDevice, 아니면 WebSerialDevice), 버튼 동작: **연결/끊기**, **실행**(`run(code)`; 콘솔에 `system` 행 "실행을 시작했어요"→ 출력 행 스트리밍 → 끝나면 "실행이 끝났어요" 또는 Traceback 행(stderr, 영어 그대로) + `line` 있으면 `reveal(line)`으로 코드 줄·블록 강조), **보드에 저장**(`libFilesFor(usedBlockTypes)` → `listFiles()`로 없는 것만 `fetchLibFiles` → `saveFile`, 그다음 `saveFile("main.py", code)` → `softReset()`; 진행 행 "ssd1306.py 올리는 중…"), **멈춤**(`stop()`). 상태 배지: 끊김(회색 `Unplug`), 연결됨(초록 `Usb`), 실행 중(파랑 `Loader2` 회전), 저장 중. 오류는 토스트 + 콘솔 `system` 행.
- [ ] `DeviceBar.tsx`로 상단 버튼을 옮기고 `LabPage`에서 `ConsolePanel entries = [...lintEntries, ...deviceEntries]`(장치 행은 아래에, 최근 500행 유지, "지우기" 버튼). 실행 중에는 블록·코드 편집은 허용하되 실행 버튼은 비활성.
- [ ] e2e(`e2e/device.spec.ts`, `/#/lab?device=fake`): 연결 → 배지 "연결됨"; 실행 → 콘솔에 `1` 출력 행(샘플 코드 대신 코드 모드에서 `print(1)` 입력); 오류 코드(`raise ValueError("x")` 를 코드 모드에서 입력) 실행 → 콘솔에 `ValueError: x`와 `line N` 행, 해당 줄 강조; 보드에 저장 → 콘솔에 "main.py 저장 완료" 행.
- [ ] 커밋 "보드 연결 화면: 연결·실행·저장·멈춤, 콘솔에 보드 출력, Traceback 줄 강조" → 푸시 → 배포 확인.

### Task 3: 실제 보드 검증 (컨트롤러 수행)

- [ ] 사용자가 Keyestudio ESP32 PLUS를 USB로 연결하면 Chrome에서: 연결 → 샘플(LED 깜빡이기) 실행 → 보드 LED 확인(가능하면) → 멈춤 → OLED 블록 프로그램 "보드에 저장"으로 `ssd1306.py` 자동 업로드 확인 → 일부러 `NameError`를 내는 코드 실행 → 콘솔 Traceback과 줄 강조 확인. 결과를 `docs/reports/`에 기록. 문제가 있으면 수정 Task를 추가한다.

## 완료 조건
- 가짜 장치로 e2e 통과, 배포. 실제 보드 검증 기록(또는 대기 표시).
