import type { ImportRule } from "./types";
import { NET_LIB_NAMES } from "./specs/net";
import { RFID_LIB_NAMES } from "./specs/input";

/** 이 함수들 중 하나를 부르는 꼴 `name(` */
const callsAny = (names: string[]) => new RegExp(String.raw`(?<![\w.])(?:${names.join("|")})\(`);

/** 생성 코드에 이 꼴이 보이면 이 import 줄이 필요하다. rank: machine 0 → ssd1306 1 → time 2 → 그 밖 3 */
export const IMPORT_RULES: ImportRule[] = [
  { when: /\bssd1306\./, line: "import ssd1306", rank: 1 },
  { when: /\btime\./, line: "import time", rank: 2 },
  { when: /\bdht\./, line: "import dht", rank: 3 },
  { when: /\bmath\./, line: "import math", rank: 3 },
  { when: /\brandom\./, line: "import random", rank: 3 },
  { when: /\bmfrc522\(/, line: "from mfrc522_i2c import mfrc522", rank: 3 },
  { when: /\bKeyPad\(/, line: "from keypad import KeyPad", rank: 3 },
  { when: /\birGetCMD\(/, line: "from irrecvdata import irGetCMD", rank: 3 },
  { when: /\blcd128_32\(/, line: "from lcd128_32 import lcd128_32", rank: 3 },
  { when: /\blcd128_32\(/, line: "import lcd128_32_fonts", rank: 3 },
  { when: /\bnetwork\./, line: "import network", rank: 3 },
  { when: /\bsocket\./, line: "import socket", rank: 3 },
  // 보드 라이브러리(public/lib/blocklab_*.py)의 함수: WiFi·웹서버, RFID 카드 읽기
  { when: callsAny(NET_LIB_NAMES), line: "from blocklab_net import *", rank: 3 },
  { when: callsAny(RFID_LIB_NAMES), line: "from blocklab_rfid import *", rank: 3 },
];

/** 생성기가 `Name(` 이 보이면 `from machine import …` 로 가져오는 이름 (이 순서로) */
export const MACHINE_NAMES = ["Pin", "PWM", "SoftI2C", "ADC", "TouchPad"];

/**
 * 생성기가 똑같이 다시 만드는 import 줄인지 (파서가 code_stmt 로 남기지 않고 지워도 되는지).
 * `from machine import …` 는 이름이 모두 MACHINE_NAMES 이고 `as` 가 없을 때, 그 밖에는 IMPORT_RULES 의 줄과 정확히 같을 때.
 * (지운 이름 중 코드에 `Name(` 이 남지 않는 것은 다시 생기지 않는다 — 쓰지 않는 import 이므로 괜찮다.)
 */
export function isGeneratedImport(line: string): boolean {
  const from = /^from\s+machine\s+import\s+(.+)$/.exec(line);
  if (from) return from[1].split(",").every((name) => MACHINE_NAMES.includes(name.trim()));
  const normalized = line.trim().replace(/\s+/g, " ");
  return IMPORT_RULES.some((r) => r.line === normalized);
}
