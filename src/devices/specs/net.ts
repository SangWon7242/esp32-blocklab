import type { DeviceSpec, HelperSpec, Part } from "../types";
import { isSingleArg, ORDER } from "./common";

/**
 * 큰따옴표 문자열 안에 그대로 들어가는 글 칸: 큰따옴표·역슬래시·줄바꿈이 없는 글만 (생성 코드 `"MyWiFi"` 가 깨지지 않고,
 * 파서 패턴 `"([^"\\]*)"` 이 그대로 되돌린다)
 */
export const QUOTED_TEXT = /^[^"\\\n]*$/;
/** 버튼 칸: 페이지의 `href='/cmd?led=on'` 작은따옴표 속성에도 들어가므로 작은따옴표도 막는다 */
const BUTTON_TEXT = /^[^"'\\\n]*$/;
/** 패턴 조각: 큰따옴표 문자열 하나의 내용 */
const Q = String.raw`"([^"\\]*)"`;

const text = (name: string, d: string, validate = QUOTED_TEXT): Part => ({ kind: "text", name, default: d, validate });

/**
 * WiFi (계획 11 ④). 공유기에 붙는 wifi_connect(ssid, password), 보드가 공유기가 되는 wifi_ap(name, password).
 * 둘 다 IP 주소 글을 돌려주고 이름 ip 에 담는다. 준비 줄이 도우미를 부르므로 생성기는 준비 줄을 함수 정의 뒤에 둔다(afterHelpers).
 */
export const wifi: DeviceSpec = {
  id: "wifi", category: "net", label: "WiFi", toolboxOrder: 90, colour: "#0f7c8c",
  setup: {
    blockType: "dev_wifi_connect", message: "WiFi %1 에 비밀번호 %2 로 연결하기",
    parts: [text("SSID", "MyWiFi"), text("PASSWORD", "12345678")],
    tooltip: "ip = wifi_connect(이름, 비밀번호) — 공유기에 연결될 때까지 기다리고, 받은 IP 주소를 ip 에 담습니다.",
    lines: (v) => [`ip = wifi_connect("${v.SSID}", "${v.PASSWORD}")`],
    afterHelpers: true,
    helpers: [
      {
        name: "wifi_connect", params: "ssid, password",
        body: [
          "wlan = network.WLAN(network.STA_IF)",
          "wlan.active(True)",
          "wlan.connect(ssid, password)",
          "while not wlan.isconnected():",
          "  time.sleep(0.5)",
          'print("IP:", wlan.ifconfig()[0])',
          "return wlan.ifconfig()[0]",
        ],
      },
    ],
    kind: "wifi",
    provides: () => ["ip", "wifi_connect"],
    pattern: {
      lines: [new RegExp(String.raw`^ip\s*=\s*wifi_connect\(\s*${Q}\s*,\s*${Q}\s*\)$`)],
      fields: ([m]) => ({ SSID: m[1], PASSWORD: m[2] }),
    },
  },
  extraSetups: [
    {
      blockType: "dev_wifi_ap", message: "WiFi 공유기 모드 시작하기 (이름 %1, 비밀번호 %2)",
      parts: [text("NAME", "ESP32-LAB"), text("PASSWORD", "12345678")],
      tooltip: "ip = wifi_ap(이름, 비밀번호) — 보드가 직접 WiFi 를 만듭니다. 비밀번호는 8글자 이상이어야 해요.",
      lines: (v) => [`ip = wifi_ap("${v.NAME}", "${v.PASSWORD}")`],
      afterHelpers: true,
      helpers: [
        {
          name: "wifi_ap", params: "name, password",
          body: [
            "ap = network.WLAN(network.AP_IF)",
            "ap.active(True)",
            "ap.config(essid=name, password=password)",
            "while not ap.active():",
            "  time.sleep(0.5)",
            'print("IP:", ap.ifconfig()[0])',
            "return ap.ifconfig()[0]",
          ],
        },
      ],
      kind: "wifi",
      provides: () => ["ip", "wifi_ap"],
      pattern: {
        lines: [new RegExp(String.raw`^ip\s*=\s*wifi_ap\(\s*${Q}\s*,\s*${Q}\s*\)$`)],
        fields: ([m]) => ({ NAME: m[1], PASSWORD: m[2] }),
      },
    },
  ],
  actions: [],
  values: [
    {
      blockType: "dev_wifi_ip", message: "내 IP 주소", parts: [],
      tooltip: "ip — WiFi 준비 블록이 받은 보드의 IP 주소 (글)",
      code: () => "ip",
      output: "String",
      order: ORDER.ATOMIC,
      pattern: { kind: "expr", regex: /^ip$/ },
    },
  ],
};

/** 웹서버 도우미 (준비 블록): 소켓 열기, 요청 하나 받기, 응답 보내기 */
export const WEB_HELPERS: HelperSpec[] = [
  {
    name: "web_start", params: "port",
    body: [
      "s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)",
      's.bind(("", port))',
      "s.listen(5)",
      "return s",
    ],
  },
  {
    name: "web_accept", params: "s",
    body: [
      "conn, addr = s.accept()",
      "request = conn.recv(1024).decode()",
      String.raw`line = request.split("\r\n")[0]`,
      'target = line.split(" ")[1] if " " in line else "/"',
      'path, _, qs = target.partition("?")',
      "query = {}",
      'for part in qs.split("&"):',
      '  if "=" in part:',
      '    k, v = part.split("=", 1)',
      "    query[k] = v",
      "return conn, path, query",
    ],
  },
  {
    name: "web_send", params: 'conn, body, ctype="text/html"',
    body: [
      String.raw`conn.send("HTTP/1.1 200 OK\r\n")`,
      String.raw`conn.send("Content-Type: " + ctype + "\r\n")`,
      String.raw`conn.send("Connection: close\r\n\r\n")`,
      "conn.sendall(body)",
      "conn.close()",
    ],
  },
];

/** 파일 응답 (dev_web_send_file 의 선택 도우미) */
export const SEND_FILE_HELPER: HelperSpec = {
  name: "web_send_file", params: "conn, name",
  body: [
    "try:",
    "  f = open(name)",
    "  web_send(conn, f.read())",
    "  f.close()",
    "except OSError:",
    '  web_send(conn, "<h1>" + name + " not found</h1>")',
  ],
};

/** 버튼·값 페이지 (dev_web_send_page 의 선택 도우미) */
export const PAGE_HELPER: HelperSpec = {
  name: "web_page", params: "title, buttons, values, refresh",
  body: [
    `html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'>"`,
    "if refresh > 0:",
    `  html += "<meta http-equiv='refresh' content='" + str(refresh) + "'>"`,
    'html += "<title>" + title + "</title></head><body><h1>" + title + "</h1>"',
    'for b in buttons.split(","):',
    "  if b:",
    `    html += "<p><a href='/cmd?" + b + "'><button>" + b + "</button></a></p>"`,
    'for v in values.split(","):',
    "  if v:",
    '    html += "<p>" + v + "</p>"',
    'return html + "</body></html>"',
  ],
};

/** JSON 응답 한 쌍: `\"temp\": " + str(V1)` 꼴. 키는 큰따옴표 문자열 안의 \" … \" 사이에 든다 */
const jsonPair = (key: string, value: string) => String.raw`\"${key}\": " + str(${value})`;
const RE_JSON_KEY = String.raw`\\"([^"\\]*)\\": " \+ str\((.+)\)`;
const JSON_TAIL = String.raw` \+ "\}", "application/json"\)$`;

/**
 * 웹서버 (계획 11 ④, 키트 2-2-05·07 의 socket 꼴). 이름 server 고정. 반복 안의 "요청 받기" 가 conn·path·query 를 정하고,
 * 응답 블록이 conn 으로 답한 뒤 연결을 닫는다. 페이지·파일 응답은 그 블록을 쓸 때만 도우미가 생긴다(선택 도우미).
 */
export const web: DeviceSpec = {
  id: "web", category: "net", label: "웹서버", toolboxOrder: 91, colour: "#006c65",
  setup: {
    blockType: "dev_web_setup", message: "웹서버 시작하기 (포트 %1)",
    parts: [{ kind: "number", name: "PORT", default: 80, min: 1, max: 65535 }],
    tooltip: "server = web_start(80) — 이 포트로 들어오는 요청을 기다리는 웹서버를 엽니다.",
    lines: (v) => [`server = web_start(${v.PORT})`],
    afterHelpers: true,
    helpers: WEB_HELPERS,
    kind: "web",
    provides: () => ["server", ...WEB_HELPERS.map((h) => h.name)],
    pattern: {
      lines: [/^server\s*=\s*web_start\(\s*(\d+)\s*\)$/],
      fields: ([m]) => (Number(m[1]) >= 1 && Number(m[1]) <= 65535 ? { PORT: m[1] } : null),
    },
  },
  actions: [
    {
      blockType: "dev_web_accept", message: "요청 받기 (경로는 path, 질의는 query 에)", parts: [],
      tooltip: "conn, path, query = web_accept(server) — 손님(브라우저)이 올 때까지 기다렸다가 주소의 경로와 물음표(?) 뒤 질의를 받습니다. 계속 반복 안에 둡니다.",
      code: () => "conn, path, query = web_accept(server)",
      defines: ["conn", "path", "query"],
      pattern: { kind: "lines", lines: [/^conn\s*,\s*path\s*,\s*query\s*=\s*web_accept\(\s*server\s*\)$/], values: () => ({}) },
    },
    {
      blockType: "dev_web_send_text", message: "글 %1 응답하기",
      parts: [{ kind: "value", name: "TEXT", check: "String", shadow: "Hello" }],
      tooltip: "web_send(conn, 글) — 받은 요청에 글(HTML)로 답하고 연결을 닫습니다. 숫자는 '글자로' 블록으로 바꿔 넣어요.",
      code: (v) => `web_send(conn, ${v.TEXT})`,
      // web_send(conn, web_page(…)) 는 페이지 응답 블록 것 (web_page 도우미가 학생 함수면 코드로 남는다)
      pattern: { kind: "lines", lines: [/^web_send\(conn, (?!web_page\()(.+)\)$/], values: ([m]) => (isSingleArg(m[1]) ? { TEXT: m[1] } : null) },
    },
    {
      blockType: "dev_web_send_page", message: "페이지 응답하기 (제목 %1, 버튼 %2, 값 %3, 새로고침 %4 초)",
      parts: [
        text("TITLE", "ESP32"), text("BUTTONS", "led=on,led=off", BUTTON_TEXT),
        { kind: "value", name: "VALUES", check: "String", shadow: "" },
        { kind: "number", name: "REFRESH", default: 0, min: 0, max: 3600 },
      ],
      tooltip: "web_send(conn, web_page(제목, 버튼, 값, 초)) — 버튼(쉼표로 나눔, 누르면 /cmd?led=on 으로 감)과 값(쉼표로 나눔)이 든 페이지로 답합니다. 새로고침이 0보다 크면 그 초마다 다시 읽어요.",
      code: (v) => `web_send(conn, web_page("${v.TITLE}", "${v.BUTTONS}", ${v.VALUES}, ${v.REFRESH}))`,
      helper: PAGE_HELPER,
      pattern: {
        kind: "lines",
        lines: [new RegExp(String.raw`^web_send\(conn, web_page\(${Q}, ${Q}, (.+), (\d+)\)\)$`)],
        values: ([m]) => (isSingleArg(m[3]) ? { TITLE: m[1], BUTTONS: m[2], VALUES: m[3], REFRESH: m[4] } : null),
      },
    },
    {
      blockType: "dev_web_send_json", message: "JSON 응답하기 (%1: %2, %3: %4)",
      parts: [text("K1", "temp"), { kind: "value", name: "V1", shadow: 0 }, text("K2", "hum"), { kind: "value", name: "V2", shadow: 0 }],
      tooltip: 'web_send(conn, JSON 글, "application/json") — {"temp": 값, "hum": 값} 처럼 앱이 읽기 좋은 JSON 으로 두 값을 답합니다.',
      code: (v) => `web_send(conn, "{${jsonPair(v.K1, v.V1)} + ", ${jsonPair(v.K2, v.V2)} + "}", "application/json")`,
      pattern: {
        kind: "lines",
        lines: [new RegExp(String.raw`^web_send\(conn, "\{${RE_JSON_KEY} \+ ", ${RE_JSON_KEY}${JSON_TAIL}`)],
        values: ([m]) => (isSingleArg(m[2]) && isSingleArg(m[4]) ? { K1: m[1], V1: m[2], K2: m[3], V2: m[4] } : null),
      },
    },
    {
      blockType: "dev_web_send_json1", message: "JSON 응답하기 (%1: %2)",
      parts: [text("K1", "temp"), { kind: "value", name: "V1", shadow: 0 }],
      tooltip: 'web_send(conn, JSON 글, "application/json") — {"temp": 값} 처럼 값 하나를 JSON 으로 답합니다.',
      code: (v) => `web_send(conn, "{${jsonPair(v.K1, v.V1)} + "}", "application/json")`,
      pattern: {
        kind: "lines",
        lines: [new RegExp(String.raw`^web_send\(conn, "\{${RE_JSON_KEY}${JSON_TAIL}`)],
        values: ([m]) => (isSingleArg(m[2]) ? { K1: m[1], V1: m[2] } : null),
      },
    },
    {
      blockType: "dev_web_send_file", message: "파일 %1 응답하기",
      parts: [text("NAME", "index.html")],
      tooltip: "web_send_file(conn, 파일 이름) — 보드에 저장한 파일(index.html 등)을 읽어 답합니다. 파일이 없으면 not found 를 보여 줘요.",
      code: (v) => `web_send_file(conn, "${v.NAME}")`,
      helper: SEND_FILE_HELPER,
      pattern: { kind: "lines", lines: [new RegExp(String.raw`^web_send_file\(conn, ${Q}\)$`)], values: ([m]) => ({ NAME: m[1] }) },
    },
  ],
  values: [
    {
      blockType: "dev_web_path_is", message: "경로가 %1 인가",
      parts: [text("PATH", "/")],
      tooltip: 'path == "/" — 받은 요청의 경로(주소에서 물음표 앞)가 이 글과 같으면 참',
      code: (v) => `path == "${v.PATH}"`,
      output: "Boolean",
      order: ORDER.RELATIONAL,
      pattern: { kind: "expr", regex: new RegExp(String.raw`^path == ${Q}$`), values: (m) => ({ PATH: m[1] }) },
    },
    {
      blockType: "dev_web_query", message: "질의 값 %1",
      parts: [text("KEY", "led")],
      tooltip: 'query.get("led", "") — 주소의 ?led=on 에서 led 의 값 (없으면 빈 글)',
      code: (v) => `query.get("${v.KEY}", "")`,
      output: "String",
      pattern: { kind: "expr", regex: new RegExp(String.raw`^query\.get\(${Q}, ""\)$`), values: (m) => ({ KEY: m[1] }) },
    },
    {
      blockType: "dev_web_has_query", message: "질의 %1 이 %2 인가",
      parts: [text("KEY", "led"), text("VALUE", "on")],
      tooltip: 'query.get("led", "") == "on" — 주소에 ?led=on 이 있으면 참',
      code: (v) => `query.get("${v.KEY}", "") == "${v.VALUE}"`,
      output: "Boolean",
      order: ORDER.RELATIONAL,
      pattern: { kind: "expr", regex: new RegExp(String.raw`^query\.get\(${Q}, ""\) == ${Q}$`), values: (m) => ({ KEY: m[1], VALUE: m[2] }) },
    },
  ],
};
