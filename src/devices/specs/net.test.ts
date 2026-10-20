/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { forever, fromCode, ifThen, num, print, program, toCode, type B } from "../testkit";
import { workspaceJsonToCode, workspaceJsonToCodeWithMap } from "@/codegen";
import { netContent } from "@/docs/content/net";
import { isProgramName } from "@/blocks/names";
import { libFilesFor, libFilesForProgram, setupsOf } from "../registry";
import { NET_LIB_NAMES, web, wifi } from "./net";

const text = (s: string): B => ({ type: "text", fields: { TEXT: s } });
const pinOut = (pin: number, name: string): B => ({ type: "esp_pin_setup", fields: { PIN: pin, MODE: "OUT", VAR: { id: `var_${name}` } } });
const pinWrite = (name: string, v: string): B => ({ type: "esp_pin_write", fields: { VAR: { id: `var_${name}` }, VALUE: v } });
const LIB = readFileSync(path.resolve(import.meta.dirname, "../../../public/lib/blocklab_net.py"), "utf8");

describe("보드 라이브러리 blocklab_net.py", () => {
  it("NET_LIB_NAMES 의 함수를 모두, 그것만 정의하고 network·socket·time 을 스스로 가져온다", () => {
    expect([...LIB.matchAll(/^def (\w+)\(/gm)].map((m) => m[1])).toEqual(NET_LIB_NAMES);
    for (const line of ["import network", "import socket", "import time"]) expect(LIB.split("\n")).toContain(line);
    expect(LIB).toContain('def web_send(conn, body, ctype="text/html"):');
  });
  it("맨 위에 무엇을 하는 파일인지 한국어 주석", () => {
    expect(LIB.split("\n")[0]).toMatch(/^# .*blocklab_net/);
  });
  it("WiFi·웹서버 준비 블록을 쓰면 보드에 함께 올린다 (import 줄로도)", () => {
    expect(libFilesFor(["dev_wifi_connect"])).toEqual(["blocklab_net.py"]);
    expect(libFilesFor(["dev_wifi_ap", "dev_web_setup"])).toEqual(["blocklab_net.py"]);
    expect(libFilesForProgram({ code: "from blocklab_net import *\nip = wifi_connect(\"a\", \"b\")\n", blockTypes: [] })).toEqual(["blocklab_net.py"]);
  });
  it("라이브러리 함수 이름은 학생 변수·함수 이름으로 쓸 수 없다", () => {
    for (const n of NET_LIB_NAMES) expect(isProgramName(n), n).toBe(true);
  });
});

describe("WiFi 연결 (dev_wifi_connect)", () => {
  const code = ["from blocklab_net import *", "", 'ip = wifi_connect("MyWiFi", "12345678")', "", "print(ip)", ""].join("\n");
  const blocks: B[] = [{ type: "dev_wifi_connect", fields: { SSID: "MyWiFi", PASSWORD: "12345678" } }, print({ type: "dev_wifi_ip" })];

  it("라이브러리 import 한 줄과 준비 줄 ip = wifi_connect(…) (함수 정의 없음)", () => {
    expect(toCode(blocks)).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["start_program"]);
    expect(r.types).toEqual(["dev_wifi_connect", "esp_print", "dev_wifi_ip"]);
    expect(r.body[0].fields).toEqual({ SSID: "MyWiFi", PASSWORD: "12345678" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("준비 블록이 다른 블록 뒤에 있어도 준비 줄은 사용자 함수 정의 뒤, 본문 맨 앞", () => {
    const def: B = { type: "procedures_defnoreturn", fields: { NAME: "hello" }, inputs: { STACK: { block: print(num(0)) } } };
    const json = program([print(num(1)), ...blocks]);
    (json.blocks.blocks as unknown as B[]).unshift(def);
    const out = workspaceJsonToCode(json);
    expect(out.indexOf("ip = wifi_connect")).toBeGreaterThan(out.indexOf("def hello():"));
    expect(out.indexOf("ip = wifi_connect")).toBeLessThan(out.indexOf("print(1)"));
  });
  it("준비 블록 코멘트는 그 줄에 붙어 돌아온다", () => {
    const commented = code.replace('ip = wifi_connect("MyWiFi", "12345678")', '# 공유기에 연결\nip = wifi_connect("MyWiFi", "12345678")  # 집 WiFi');
    const r = fromCode(commented);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(commented);
  });
  it("WiFi 준비가 없으면 ip 는 그냥 변수", () => {
    expect(fromCode('ip = "1.2.3.4"\nprint(ip)\n').types).toEqual(["variables_set", "text", "esp_print", "variables_get"]);
  });
});

describe("WiFi 공유기 모드 (dev_wifi_ap)", () => {
  const code = ["from blocklab_net import *", "", 'ip = wifi_ap("ESP32-LAB", "12345678")', "", "print(ip)", ""].join("\n");

  it("공유기 모드 준비 줄", () => {
    expect(toCode([{ type: "dev_wifi_ap", fields: { NAME: "ESP32-LAB", PASSWORD: "12345678" } }, print({ type: "dev_wifi_ip" })])).toBe(code);
    expect(LIB).toContain("ap.config(essid=name, password=password)");
  });
  it("왕복: unparsed 0", () => {
    const r = fromCode(code);
    expect(r.types).toEqual(["dev_wifi_ap", "esp_print", "dev_wifi_ip"]);
    expect(r.body[0].fields).toEqual({ NAME: "ESP32-LAB", PASSWORD: "12345678" });
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
});

describe("웹서버 (dev_web_*)", () => {
  const setupLines = ['ip = wifi_connect("MyWiFi", "12345678")', "server = web_start(80)", ""];
  const head = ["from machine import Pin", "from blocklab_net import *", "", "led = Pin(2, Pin.OUT)", ""];
  const loop = [
    "print(ip)",
    "while True:",
    "    conn, path, query = web_accept(server)",
    '    if query.get("led", "") == "on":',
    "        led.value(1)",
    '    if path == "/data":',
    '        web_send(conn, "{\\"temp\\": " + str(25) + ", \\"hum\\": " + str(60) + "}", "application/json")',
    '    if path == "/one":',
    '        web_send(conn, "{\\"temp\\": " + str(25) + "}", "application/json")',
    '    if path == "/file":',
    '        web_send_file(conn, "index.html")',
    '    if path == "/t":',
    '        web_send(conn, "Hello")',
    '    web_send(conn, web_page("ESP32", "led=on,led=off", query.get("led", ""), 0))',
    "",
  ];
  const code = [...head, ...setupLines, ...loop].join("\n");
  const pathIs = (p: string): B => ({ type: "dev_web_path_is", fields: { PATH: p } });
  const blocks: B[] = [
    pinOut(2, "led"),
    { type: "dev_wifi_connect", fields: { SSID: "MyWiFi", PASSWORD: "12345678" } },
    { type: "dev_web_setup", fields: { PORT: 80 } },
    print({ type: "dev_wifi_ip" }),
    forever([
      { type: "dev_web_accept" },
      ifThen({ type: "dev_web_has_query", fields: { KEY: "led", VALUE: "on" } }, [pinWrite("led", "1")]),
      ifThen(pathIs("/data"), [{ type: "dev_web_send_json", fields: { K1: "temp", K2: "hum" }, inputs: { V1: { block: num(25) }, V2: { block: num(60) } } }]),
      ifThen(pathIs("/one"), [{ type: "dev_web_send_json1", fields: { K1: "temp" }, inputs: { V1: { block: num(25) } } }]),
      ifThen(pathIs("/file"), [{ type: "dev_web_send_file", fields: { NAME: "index.html" } }]),
      ifThen(pathIs("/t"), [{ type: "dev_web_send_text", inputs: { TEXT: { block: text("Hello") } } }]),
      { type: "dev_web_send_page", fields: { TITLE: "ESP32", BUTTONS: "led=on,led=off", REFRESH: 0 }, inputs: { VALUES: { block: { type: "dev_web_query", fields: { KEY: "led" } } } } },
    ]),
  ];

  it("모든 웹서버 블록의 코드 (함수 정의 없이 from blocklab_net import *)", () => {
    expect(toCode(blocks, ["led"])).toBe(code);
  });
  it("왕복: 같은 블록들, unparsed 0", () => {
    const r = fromCode(code);
    expect(r.tops).toEqual(["start_program"]);
    expect(r.types).toEqual([
      "esp_pin_setup", "dev_wifi_connect", "dev_web_setup", "esp_print", "dev_wifi_ip",
      "flow_repeat_forever", "dev_web_accept",
      "controls_if", "esp_pin_write", "dev_web_has_query",
      "controls_if", "dev_web_send_json", "math_number", "math_number", "dev_web_path_is",
      "controls_if", "dev_web_send_json1", "math_number", "dev_web_path_is",
      "controls_if", "dev_web_send_file", "dev_web_path_is",
      "controls_if", "dev_web_send_text", "text", "dev_web_path_is",
      "dev_web_send_page", "dev_web_query",
    ]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(code);
  });
  it("필드 값이 돌아온다 (경로·질의·JSON 키·페이지 칸)", () => {
    const r = fromCode(code.replace('"/data"', '"/sensor"').replace('"temp\\": " + str(25) + ", ', '"t\\": " + str(25) + ", ').replace("led=on,led=off", "fan=on,fan=off").replace(", 0))", ", 5))"));
    expect(r.unparsed).toEqual([]);
    const all = JSON.stringify(r.body);
    expect(all).toContain('"PATH":"/sensor"');
    expect(all).toContain('"K1":"t","K2":"hum"');
    expect(all).toContain('"BUTTONS":"fan=on,fan=off","REFRESH":5');
  });
  it("웹서버 준비와 응답만 써도 함수 정의는 없다", () => {
    const out = toCode([{ type: "dev_web_setup", fields: { PORT: 8080 } }, forever([{ type: "dev_web_accept" }, { type: "dev_web_send_text", inputs: { TEXT: { block: text("ok") } } }])]);
    expect(out).toBe('from blocklab_net import *\n\nserver = web_start(8080)\n\nwhile True:\n    conn, path, query = web_accept(server)\n    web_send(conn, "ok")\n');
    const r = fromCode(out);
    expect(r.types).toEqual(["dev_web_setup", "flow_repeat_forever", "dev_web_accept", "dev_web_send_text", "text"]);
    expect(r.unparsed).toEqual([]);
    expect(r.code).toBe(out);
  });
  it("요청 받기가 정한 path·query·conn 은 학생 변수로 돌아온다", () => {
    const src = code.replace("    conn, path, query = web_accept(server)\n", "    conn, path, query = web_accept(server)\n    print(path)\n");
    const r = fromCode(src);
    expect(r.unparsed).toEqual([]);
    expect(r.types.slice(6, 9)).toEqual(["dev_web_accept", "esp_print", "variables_get"]);
    expect(r.code).toBe(src);
  });
  it("값 칸은 식으로 돌아온다 (글자로·온도 값)", () => {
    const src = code.replace("from blocklab_net import *", "import time\nfrom blocklab_net import *").replace('web_send(conn, "Hello")', "web_send(conn, str(ip))").replace("str(25) + \"}\"", "str(time.ticks_ms()) + \"}\"");
    const r = fromCode(src);
    expect(r.unparsed).toEqual([]);
    expect(r.types).toContain("calc_str");
    expect(r.types).toContain("calc_ticks");
    expect(r.code).toBe(src);
  });
  it("웹서버 준비가 없으면 web_send(…) 는 장치 블록이 아니다", () => {
    expect(fromCode('web_send(conn, "ok")\n').types).toEqual(["code_stmt"]);
  });
  it("웹서버 준비가 없으면 path == \"/\" 는 비교 블록", () => {
    expect(fromCode('path = "/"\nprint(path == "/")\n').types).toEqual(["variables_set", "text", "esp_print", "logic_compare", "variables_get", "text"]);
  });
  it("글 칸은 큰따옴표·역슬래시를 받지 않는다", () => {
    for (const p of [...setupsOf(wifi), ...setupsOf(web), ...web.actions, ...web.values].flatMap((s) => s.parts)) {
      if (p.kind !== "text") continue;
      expect(p.validate?.test('a"b'), p.name).toBe(false);
      expect(p.validate?.test("a\\b"), p.name).toBe(false);
      expect(p.validate?.test(p.default), p.name).toBe(true);
    }
  });
});

describe("코드 지도·블록 사전 예시", () => {
  it("코드 지도: 본문 앞으로 옮긴 준비 줄도 그 준비 블록 것, 코드는 지도 없이 만든 것과 같다", () => {
    const json = program([
      { type: "dev_wifi_connect", id: "w", fields: { SSID: "MyWiFi", PASSWORD: "12345678" } },
      { type: "dev_web_setup", id: "s", fields: { PORT: 80 } },
      { type: "flow_repeat_forever", id: "loop", inputs: { DO: { block: { type: "dev_web_accept", id: "acc" } } } },
    ]);
    const { code, map } = workspaceJsonToCodeWithMap(json);
    expect(code).toBe(workspaceJsonToCode(json));
    const lines = code.split("\n");
    const lineOf = (text: string) => lines.indexOf(text) + 1;
    expect(map.lineToBlock[lineOf('ip = wifi_connect("MyWiFi", "12345678")')]).toBe("w");
    expect(map.lineToBlock[lineOf("server = web_start(80)")]).toBe("s");
    expect(map.lineToBlock[lineOf("    conn, path, query = web_accept(server)")]).toBe("acc");
  });

  it("통신 블록 사전 예시는 import 를 빼면 글자 그대로 돌아온다", () => {
    for (const [type, c] of Object.entries(netContent)) {
      const r = fromCode(c.example.code);
      expect(r.unparsed, type).toEqual([]);
      const body = r.code.replace(/^(?:(?:from \S+ )?import .*\n)+\n/, "");
      expect(body, type).toBe(`${c.example.code}\n`);
    }
  });
});
