import type { BlockContent } from "../types";
import { helperDef } from "@/devices/specs/common";
import { PAGE_HELPER, SEND_FILE_HELPER, WEB_HELPERS, wifi } from "@/devices/specs/net";
import type { HelperSpec } from "@/devices/types";

/** 도우미 정의들 (생성 코드 꼴, 함수 사이 빈 줄 둘). 뒤에 준비 줄이 오도록 끝에도 빈 줄 둘 */
const defs = (hs: HelperSpec[]) => hs.map(helperDef).join("\n\n\n") + "\n\n\n";

const [CONNECT, AP] = [wifi.setup!.helpers![0], wifi.extraSetups![0].helpers![0]];
const CONNECT_LINE = 'ip = wifi_connect("MyWiFi", "12345678")';
const AP_LINE = 'ip = wifi_ap("ESP32-LAB", "12345678")';
// 생성기는 함수 뒤로 옮긴 준비 줄과 본문 사이에 빈 줄 하나를 둔다
const WIFI_SETUP = `${defs([CONNECT])}${CONNECT_LINE}\n\n`;
const AP_SETUP = `${defs([AP])}${AP_LINE}\n\n`;

/** WiFi 연결 + 웹서버 준비 (extra: 그 예시가 쓰는 선택 도우미) */
const web = (extra: HelperSpec[] = []) => `${defs([CONNECT, ...WEB_HELPERS, ...extra])}${CONNECT_LINE}\nserver = web_start(80)\n\n`;

const WIFI_TIP = "먼저 WiFi 연결(또는 공유기 모드) 블록이 있어야 해요.";
const WEB_TIP = "먼저 WiFi 연결 블록과 웹서버 시작 블록이 있어야 해요.";
const ACCEPT_TIP = "계속 반복 안에서 '요청 받기' 다음에 써요. 응답 블록은 답을 보낸 뒤 연결을 닫아요.";
const ONE_ANSWER_TIP = "요청 하나에는 응답 하나만 보내요. 만약 블록으로 경로마다 다른 응답을 골라요.";
const ADC2_TIP = "WiFi 를 쓰는 동안 25·26·27·4 같은 ADC2 핀은 아날로그 값을 못 읽어요. 아날로그 센서는 32~39 번 핀에 연결해요.";

/** 통신 카테고리 블록 설명 (src/devices/specs/net.ts) */
export const netContent: Record<string, BlockContent> = {
  dev_wifi_connect: {
    concept: "집이나 학교의 WiFi 공유기에 보드를 연결해요. 연결될 때까지 기다렸다가 공유기가 정해 준 IP 주소를 ip 에 담고 시리얼에도 찍어 줍니다. 이 IP 주소를 휴대폰이나 컴퓨터 브라우저 주소창에 넣으면 보드의 웹서버에 들어갈 수 있어요.",
    example: { title: "WiFi 에 연결하고 IP 주소 출력하기", code: `${WIFI_SETUP}print(ip)` },
    tips: ["WiFi 이름과 비밀번호는 대소문자까지 똑같이 적어요.", "ESP32 는 2.4GHz WiFi 에만 연결돼요. 5GHz 전용 공유기는 보이지 않아요.", ADC2_TIP],
  },
  dev_wifi_ap: {
    concept: "공유기 없이 보드가 직접 WiFi 를 만들어요. 휴대폰 WiFi 목록에서 이 이름을 골라 비밀번호로 연결하면 보드와 바로 이야기할 수 있습니다. 보드의 IP 주소는 보통 192.168.4.1 이고 ip 에 담겨요.",
    example: { title: "공유기 모드로 WiFi 만들기", code: `${AP_SETUP}print(ip)` },
    tips: ["비밀번호는 8글자 이상이어야 해요.", "공유기 모드에서는 휴대폰이 인터넷을 못 쓸 수 있어요. 보드 페이지를 다 보면 원래 WiFi 로 돌아가요.", ADC2_TIP],
  },
  dev_wifi_ip: {
    concept: "WiFi 준비 블록이 받은 보드의 IP 주소를 '192.168.0.23' 같은 글로 알려 줘요. 코드로는 ip 이고, 출력하거나 OLED 에 보여 주면 브라우저에 어떤 주소를 넣어야 하는지 알 수 있어요.",
    example: { title: "IP 주소를 두 번 알려 주기", code: `${WIFI_SETUP}print("내 주소:")\nprint(ip)` },
    tips: [WIFI_TIP],
  },
  dev_web_setup: {
    concept: "보드를 작은 웹서버로 만들어 브라우저의 요청을 기다리게 해요. 요청 받기·응답하기 함수가 함께 만들어지고, 서버 이름은 server 로 정해져 있습니다. 포트는 보통 80 이라 주소창에 IP 주소만 적으면 돼요.",
    example: {
      title: "접속하면 인사하는 웹서버",
      code: `${web()}while True:\n    conn, path, query = web_accept(server)\n    web_send(conn, "<h1>Hello ESP32</h1>")`,
    },
    tips: ["먼저 WiFi 연결 블록이 있어야 해요.", "포트를 80 이 아닌 수로 바꾸면 주소창에 192.168.0.23:8080 처럼 포트까지 적어요."],
  },
  dev_web_accept: {
    concept: "브라우저가 찾아올 때까지 기다렸다가 요청 하나를 받아요. 주소에서 물음표(?) 앞부분은 path(경로), 물음표 뒤의 led=on 같은 부분은 query(질의)에 담깁니다. 받은 다음에는 꼭 응답 블록 하나로 답해 줘요.",
    example: {
      title: "받은 경로 출력하고 답하기",
      code: `${web()}while True:\n    conn, path, query = web_accept(server)\n    print(path)\n    web_send(conn, "ok")`,
    },
    tips: [WEB_TIP, "계속 반복 안에 두어야 손님을 여러 번 받을 수 있어요. 요청을 기다리는 동안 반복이 멈춰 있으니 기다리기 블록은 없어도 돼요."],
  },
  dev_web_send_text: {
    concept: "받은 요청에 글로 답하고 연결을 닫아요. 글에 <h1>제목</h1> 같은 HTML 을 넣으면 브라우저가 꾸며서 보여 줍니다. 숫자를 보내려면 '글자로' 블록으로 바꿔서 넣어요.",
    example: {
      title: "지난 시간 알려 주는 페이지",
      code: `${web()}while True:\n    conn, path, query = web_accept(server)\n    web_send(conn, "<h1>" + str(time.ticks_ms()) + "</h1>")`,
    },
    tips: [ACCEPT_TIP],
  },
  dev_web_send_page: {
    concept: "제목, 버튼, 값이 든 웹 페이지를 만들어 답해요. 버튼 칸에 led=on,led=off 처럼 쉼표로 나눠 적으면 버튼이 생기고, 누르면 /cmd?led=on 주소로 다시 요청이 옵니다. 값 칸도 쉼표로 나눠 여러 줄을 보여 주고, 새로고침에 초를 넣으면 그 간격으로 페이지를 다시 읽어요.",
    example: {
      title: "버튼으로 LED 켜고 끄기",
      code: `led = Pin(2, Pin.OUT)\n\n\n${web([PAGE_HELPER])}while True:\n    conn, path, query = web_accept(server)\n    if query.get("led", "") == "on":\n        led.value(1)\n    if query.get("led", "") == "off":\n        led.value(0)\n    web_send(conn, web_page("ESP32", "led=on,led=off", "LED: " + str(led.value()), 0))`,
    },
    tips: [ACCEPT_TIP, "버튼과 값 칸에는 쉼표가 나누는 표시라서, 글 안에 쉼표를 넣지 않아요."],
  },
  dev_web_send_json: {
    concept: "두 값을 JSON 이라는 정해진 꼴로 답해요. {\"temp\": 25, \"hum\": 60} 처럼 이름과 값이 짝지어 가서 앱이나 다른 프로그램이 읽기 좋습니다. 값 칸에는 센서 값 같은 숫자를 넣어요.",
    example: {
      title: "온습도를 JSON 으로 알려 주기",
      code: `dht11 = dht.DHT11(Pin(13))\n\n\n${web()}while True:\n    conn, path, query = web_accept(server)\n    dht11.measure()\n    web_send(conn, "{\\"temp\\": " + str(dht11.temperature()) + ", \\"hum\\": " + str(dht11.humidity()) + "}", "application/json")`,
    },
    tips: [ACCEPT_TIP, "이름 칸에는 영어 낱말을 쓰면 앱에서 다루기 쉬워요."],
  },
  dev_web_send_json1: {
    concept: "값 하나를 JSON 꼴로 답해요. {\"light\": 2048} 처럼 이름 하나와 값 하나가 갑니다. 앱이 센서 값 하나만 물어볼 때 써요.",
    example: {
      title: "조도 값을 JSON 으로 알려 주기",
      code: `light = ADC(Pin(34))\nlight.atten(ADC.ATTN_11DB)\nlight.width(ADC.WIDTH_12BIT)\n\n\n${web()}while True:\n    conn, path, query = web_accept(server)\n    web_send(conn, "{\\"light\\": " + str(light.read()) + "}", "application/json")`,
    },
    tips: [ACCEPT_TIP, ADC2_TIP],
  },
  dev_web_send_file: {
    concept: "보드에 저장해 둔 파일(index.html 등)을 읽어 답해요. 직접 만든 웹 페이지를 파일로 올려 두면 그 페이지를 그대로 보여 줄 수 있습니다. 파일이 없으면 'not found' 라고 답해요.",
    example: {
      title: "index.html 페이지 보여 주기",
      code: `${web([SEND_FILE_HELPER])}while True:\n    conn, path, query = web_accept(server)\n    web_send_file(conn, "index.html")`,
    },
    tips: [ACCEPT_TIP, "파일은 앱 화면에서 보드에 함께 저장해요. 파일 이름은 대소문자까지 똑같이 적어요."],
  },
  dev_web_path_is: {
    concept: "받은 요청의 경로가 이 글과 같은지 참·거짓으로 알려 줘요. 주소가 192.168.0.23/data 이면 경로는 /data 이고, 주소만 적으면 / 예요. 만약 블록에 끼워 경로마다 다른 답을 보내요.",
    example: {
      title: "경로마다 다르게 답하기",
      code: `${web()}while True:\n    conn, path, query = web_accept(server)\n    if path == "/data":\n        web_send(conn, str(time.ticks_ms()))\n    else:\n        web_send(conn, "<h1>Home</h1>")`,
    },
    tips: [WEB_TIP, "경로는 / 로 시작해요."],
  },
  dev_web_query: {
    concept: "주소의 물음표(?) 뒤에 온 질의에서 이름에 붙은 값을 알려 줘요. 주소가 /cmd?led=on 이면 질의 값 led 는 'on' 이고, 그 이름이 없으면 빈 글이 나옵니다.",
    example: {
      title: "받은 질의 값 출력하기",
      code: `${web()}while True:\n    conn, path, query = web_accept(server)\n    print(query.get("led", ""))\n    web_send(conn, "ok")`,
    },
    tips: [WEB_TIP],
  },
  dev_web_has_query: {
    concept: "주소의 질의에 이 이름과 값이 있는지 참·거짓으로 알려 줘요. 페이지 버튼 led=on 을 누르면 질의 led 가 on 인가 가 참이 됩니다. 만약 블록에 끼워 버튼마다 할 일을 정해요.",
    example: {
      title: "버튼 주소로 LED 켜기",
      code: `led = Pin(2, Pin.OUT)\n\n\n${web()}while True:\n    conn, path, query = web_accept(server)\n    if query.get("led", "") == "on":\n        led.value(1)\n    web_send(conn, "ok")`,
    },
    tips: [WEB_TIP, ONE_ANSWER_TIP],
  },
};
