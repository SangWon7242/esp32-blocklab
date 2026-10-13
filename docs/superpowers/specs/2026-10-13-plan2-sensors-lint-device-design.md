# ESP32 블록랩 — 계획 2 설계 (편집기 정리, 장치 레지스트리, 검사 엔진·콘솔, 보드 연결)

작성일: 2026-10-13
상태: 승인됨
기준 문서: `2026-10-13-esp32-blocklab-design.md` (이 문서는 그 부록이며, 충돌 시 이 문서가 우선)

## 0. 배경

계획 1(편집기 코어)이 배포된 뒤 선생님이 확인한 문제와 추가 요구:

1. 블록 팔레트를 열었다 닫으면 세로 스크롤바가 화면에 남는다.
2. 계획 1의 최종 리뷰에서 미룬 문제들(좁은 화면 레이아웃, 배지·스크롤·배치 등)을 모두 해결한다.
3. ESP32 블록이 너무 적다. 키트의 센서·장치마다 블록을 세밀하게 나눠 만든다.
4. 블록을 잘못 놓으면 즉시 오류/주의를 표시한다. 블록에서는 한글, 파이썬 편집기의 콘솔에서는 영어.
5. 오류·주의 표시를 누르면 어떤 코드(줄)에서 생긴 문제인지 확인할 수 있어야 한다.
6. 보드 연결(기준 문서 7장).

## 1. 스크롤바 버그와 남은 문제 (계획 2A)

**원인**: Blockly는 팔레트(flyout)를 닫을 때 팔레트 스크롤바 SVG에 `display="none"` 속성을 둔다. Tailwind preflight의 `svg { display: block }` CSS 규칙이 SVG 속성보다 우선해 스크롤바가 계속 보인다(배포 페이지 DOM에서 확인: 팔레트는 `display:none`, 스크롤바는 `display:block`).
**수정**: `src/index.css`에 `svg[display="none"] { display: none !important; }`를 둔다. e2e: 카테고리를 열고 작업판을 눌러 닫은 뒤 `.blocklyFlyoutScrollbar`가 보이지 않음을 확인.

**함께 정리하는 문제**
- 좁은 화면(1024px 미만): 코드 패널이 "코드" 탭 뒤로 들어가고, 헤더는 줄바꿈 대신 가로 스크롤 없이 접힌다(메뉴 글자 숨기고 아이콘만). 패널에 접기/펼치기 단추(`PanelLeftClose`/`PanelRightClose` 아이콘).
- 블록 모드에서 "변환 못 한 줄" 배지는 코드 블록(`code_stmt`/`code_expr`) 개수로 다시 센다.
- 코드→블록 전환 때 작업판 스크롤 위치를 유지하고 실행취소 기록을 비운다.
- 파싱된 함수 블록은 시작 블록 오른쪽에 배치한다.
- `for i in range` 안의 `i`는 변수로 등록해 "변환 못 함"으로 세지 않는다.
- 주석 가장자리: `|`로 시작하는 주석은 `\|`로 이스케이프, 접힌 줄의 주석은 준비 블록 코멘트로 보존.
- 자유 코딩 화면을 `React.lazy`로 지연 로딩해 홈 화면이 Blockly를 받지 않게 한다.
- 함수 이름 필드에도 영문 식별자 검사를 적용한다.
- 콘솔 패널 자리를 위해 하단 패널 틀을 만든다(계획 2B가 내용을 채움).

## 2. 장치 레지스트리와 센서 블록 (계획 2A)

### 2.1 왜 레지스트리인가

센서 20여 종·블록 70여 개를 블록 정의·생성기·파서 세 곳에 따로 적으면 유지가 안 된다. **장치 하나 = 선언 하나**로 적고, 나머지는 선언에서 만든다.

### 2.2 선언 형식 (`src/devices/registry.ts`)

```ts
type DeviceSpec = {
  id: string;                       // "led", "ultrasonic", "dht11" …
  category: DeviceCategory;         // "pin" | "led" | "switch" | "sensor" | "sound" | "motor" | "display" | "input"
  label: string;                    // 한글 이름 "초음파 센서"
  setup: {
    blockType: string;              // 기존 이름 유지: "esp_ultrasonic_setup" 등
    message: string;                // "초음파 센서 준비하기 (trig 핀 %1, echo 핀 %2)"
    fields: FieldSpec[];            // 핀 번호(field_number, min/max, 입력전용 핀 제한), 변수 이름(field_variable), 주소 등
    lines: (f) => string[];         // 준비 줄: ["trig = Pin(13, Pin.OUT)", "echo = Pin(12, Pin.IN)"]
    helpers?: HelperSpec[];         // 도우미 함수: 이름 + 본문 줄 (get_distance, show …)
    imports?: string[];             // "import dht", "from mfrc522_i2c import mfrc522"
    libFiles?: string[];            // 보드에 함께 올릴 파일: "ssd1306.py", "mfrc522_i2c.py" …
    patterns: SetupPattern[];       // 파서가 알아볼 준비 줄 정규식(연속 줄 묶음 포함)과 도우미 표준 본문
  };
  actions: ActionSpec[];            // 명령 블록: { blockType, message, args, code: (v) => "servo.duty_u16(8100)", pattern }
  values: ValueSpec[];              // 값 블록: { blockType, message, args, code: (v) => "get_distance()", order, outputType, pattern }
  range?: Record<string, [number, number]>;  // 검사용 값 범위(각도 0~180 등)
};
```

레지스트리에서 자동으로 만드는 것: 블록 JSON(테마 스타일 `hardware_blocks`, 카테고리별 색 보조), 툴박스의 하드웨어 하위 카테고리, `forBlock` 생성기(준비 줄 끌어올리기·도우미 제공·import), 파서 접기 규칙(준비 패턴 → 준비 블록, 메서드 호출 → 명령/값 블록), 검사 규칙 입력(핀 필드·값 범위·장치 변수 이름), "보드에 올릴 라이브러리 목록".

기존 ESP32 블록 14개는 레지스트리로 옮기되 **블록 이름과 필드 이름을 그대로** 둔다(저장된 작품·계획 1 테스트 보존). `src/blocks/definitions/esp32.ts`, `forBlock.ts`의 esp 항목, `parser/patterns.ts`의 하드웨어 정규식은 레지스트리 산출물로 대체한다.

### 2.3 카테고리와 블록 목록

엔트리처럼 "하드웨어" 아래 세부 카테고리로 나눈다. 툴박스 순서: 시작, 흐름, 판단, 계산, 변수, 함수, **핀, LED, 버튼·스위치, 센서, 소리, 모터, 화면, 입력장치**, 코드.

| 카테고리 | 장치 | 준비 블록 | 명령·값 블록 | 생성 코드 근거 |
|---|---|---|---|---|
| 핀 | 출력 핀 | 핀 n을 출력으로 준비하고 이름 붙이기 | 켜기·끄기·값 정하기(0/1) | `Pin(n, Pin.OUT)`, `.value(1)` |
| 핀 | 입력 핀 | 핀 n을 입력(풀업 선택)으로 준비 | 값 | `Pin(n, Pin.IN, Pin.PULL_UP)`, `.value()` |
| 핀 | PWM 핀 | 핀 n을 PWM으로 준비(주파수) | 세기(0~1023 `duty`), 주파수 | `PWM(Pin(n))`, `.freq()`, `.duty()` (챕터 2·5) |
| 핀 | 아날로그 핀 | 핀 n을 아날로그 입력으로 준비 | 값(0~4095), 전압(V) | `ADC(Pin(36))`, `.atten(ADC.ATTN_11DB)`, `.width(ADC.WIDTH_12BIT)`, `.read()` |
| LED | LED | LED를 핀 n에 준비 | 켜기, 끄기, n초 깜빡이기, 밝기 0~100% | `Pin`/`PWM` (챕터 1·2) |
| LED | RGB LED | RGB LED 준비(R,G,B 핀) | 색 정하기(R,G,B 0~255), 색 고르기(색상 필드), 끄기 | 챕터 5의 `set_color` 도우미 |
| LED | 흐르는 LED | 핀 목록으로 준비 | 차례로 켜기(간격 ms) | 챕터 4 |
| 버튼·스위치 | 버튼 | 버튼을 핀 n에 준비 | 눌렸는가(참/거짓) | `Pin(n, Pin.IN, Pin.PULL_UP)`, `.value() == 0` |
| 버튼·스위치 | 틸트 스위치 | 준비 | 기울었는가 | `Pin(n, Pin.IN)` |
| 버튼·스위치 | PIR 인체감지 | 준비 | 사람이 있는가 | `Pin(n, Pin.IN)` |
| 버튼·스위치 | 조이스틱 | 준비(X,Y 핀, 버튼 핀) | X 값, Y 값, 버튼 눌렸는가 | `ADC` ×2 + `Pin` |
| 센서 | 조도 | 준비(핀) | 밝기 값(0~4095) | `ADC` |
| 센서 | 가변저항 | 준비 | 값 | `ADC` |
| 센서 | 소리 | 준비 | 소리 크기 | `ADC` |
| 센서 | 불꽃 | 준비 | 불꽃 값 | `ADC` |
| 센서 | 서미스터 | 준비 | 온도(℃) | `ADC` + 도우미 계산식(튜토리얼 2-3-20) |
| 센서 | LM35 | 준비 | 온도(℃) | `ADC` + 변환 계수 |
| 센서 | 초음파 | 준비(trig, echo) | 거리(cm) | `get_distance()` 도우미(계획 1) |
| 센서 | DHT11 | 준비(핀) | 온도(℃), 습도(%) , 측정하기 | `dht.DHT11(Pin(n))`, `.measure()`, `.temperature()`, `.humidity()` |
| 소리 | 능동 부저 | 준비 | 켜기, 끄기 | `Pin` |
| 소리 | 수동 부저 | 준비 | 음(Hz) n초 울리기, 음계(도~시, 옥타브) n박 울리기, 멈추기 | `PWM`, `.freq()`, `.duty(512)`/`.duty(0)` (튜토리얼 2-3-10) |
| 모터 | 서보 | 준비(핀) | 각도(0~180), 열기, 닫기 | `PWM`, `freq(50)`, `duty_u16` (각도→1638~8100 선형) |
| 모터 | DC 모터 | 준비(IN+, IN- 핀) | 앞으로, 뒤로, 정지, 속도(PWM) | 챕터 7 |
| 모터 | 릴레이 | 준비 | 켜기, 끄기 | `Pin` |
| 화면 | OLED | 준비(scl, sda) | 두 줄 보여주기, 글자(x,y) 적기, 지우기, 화면에 내보내기, 선·사각형 | `ssd1306` + `show` 도우미(계획 1) |
| 화면 | LCD 128×32 | 준비(sda, scl, 주소) | 글자 적기(줄, 칸), 지우기 | `lcd128_32`, `.Cursor()`, `.Display()`, `.Clear()` |
| 화면 | 7세그먼트 | 준비(SI, RCK, SCK 핀) | 숫자 표시(0~9), 점 켜기, 지우기 | 챕터 6 `hc595_shift` 도우미 + SEGCODE |
| 입력장치 | RFID | 준비(scl, sda, 주소) | 카드가 있는가, 카드 번호(목록) | `mfrc522`, `PCD_Init`, `PICC_IsNewCardPresent`, `PICC_ReadCardSerial`, `uid.uidByte` |
| 입력장치 | 키패드 | 준비(핀 8개) | 눌린 키 | `KeyPad(...).scan()` |
| 입력장치 | IR 리모컨 | 준비(핀) | 받은 값 | `irGetCMD(n).ir_read()` |

제외: 스테퍼 모터, 4자리 숫자 표시기, DAC, Wi-Fi/블루투스(2단계 밖).

### 2.4 라이브러리 동봉

Keyestudio `Library.zip`의 MicroPython 파일(`ssd1306.py`, `gfx.py`, `mfrc522_i2c.py`, `mfrc522_config.py`, `soft_iic.py`, `irrecvdata.py`, `keypad.py`, `lcd128_32.py`, `lcd128_32_fonts.py`)을 `public/lib/`에 둔다. 레지스트리의 `libFiles`가 장치별 필요 파일을 가리키고, 계획 2C의 "보드에 저장"이 함께 올린다. 라이선스 표기는 `public/lib/README.md`.

## 3. 검사 엔진과 콘솔 (계획 2B)

### 3.1 엔진 (`src/lint/`)

순수 함수 `lint(json: WorkspaceJson, lineMap: LineMap, registry): Issue[]`.
`Issue = { id, blockId?, level: "error" | "warning" | "info", ko: string, en: string, line?: number }`.

규칙:

| 수준 | 규칙 | 한글(블록·문제 패널) | 영어(콘솔) |
|---|---|---|---|
| 오류 | 시작 블록 없음 | 프로그램이 시작되면 블록이 없어요 | `Error: no "프로그램이 시작되면" block` |
| 오류 | 필수 값 칸 비어 있음 | 이 칸에 값을 넣어 주세요 | `SyntaxError: missing value for "<블록 이름>"` |
| 오류 | 준비 블록 없이 장치 사용 | led 를 먼저 준비해 주세요 (핀 블록) | `NameError: name 'led' is not defined` |
| 오류 | 핀 범위 밖 / 입력 전용 핀(34~39)에 출력 | 34번 핀은 입력만 할 수 있어요 | `ValueError: pin 34 is input-only` |
| 오류 | 값 범위 밖(레지스트리 `range`) | 각도는 0~180 사이여야 해요 | `ValueError: angle must be 0..180` |
| 주의 | 같은 핀을 두 준비 블록이 씀 | 13번 핀을 trig 와 led 가 같이 쓰고 있어요 | `Warning: pin 13 used by trig and led` |
| 주의 | 계속 반복 안에 기다리기 없음 | 반복 안에 기다리기가 없으면 보드가 바빠져요 | `Warning: loop without sleep` |
| 주의 | 시작 블록 밖에 떨어진 블록 | 시작 블록에 붙이지 않은 블록은 실행되지 않아요 | `Warning: orphan block ignored` |
| 주의 | 정한 적 없는 변수 사용 | d 는 아직 값을 정하지 않았어요 | `NameError: name 'd' may be undefined` |
| 정보 | 변환 못 한 코드 블록 | 이 코드는 블록으로 바꾸지 못했어요. 그대로 실행됩니다 | `Note: raw code kept as-is` |

규칙은 `src/lint/rules/*.ts`에 하나씩 두고 각각 단위 테스트를 갖는다.

### 3.2 코드 지도 (block ↔ 줄)

생성기가 `STATEMENT_PREFIX`로 블록 id 표식 줄을 넣어 코드를 만든 뒤 표식을 걷어 내며 `LineMap { blockToLines: Map<blockId, number[]>, lineToBlock: Map<number, blockId> }`를 만든다. 공개 함수 `generateCodeWithMap(ws): { code, map }`. 표식 없는 결과는 지금의 `generateCode`와 같아야 한다(테스트).

### 3.3 표시와 양방향 이동

- 블록 모드: 문제 블록에 Blockly 경고 아이콘(오류 빨강, 주의 노랑)과 한글 말풍선 `"<문구> — 코드 12줄"`. 말풍선/아이콘을 누르면 코드 패널의 해당 줄이 강조된다. 하단 **문제** 패널(한글 목록, 수준 아이콘 `CircleAlert`/`TriangleAlert`/`Info`)에서 항목을 누르면 블록으로 스크롤·강조하고 코드 줄도 강조한다.
- 코드 모드: 하단 **콘솔** 패널에 영어로. 문법 오류는 MicroPython 모양(`Traceback (most recent call last):` / `  File "main.py", line 12` / `SyntaxError: invalid syntax`), 검사 결과는 표의 영어 문구와 `line N`. 항목을 누르면 코드 줄과 그 줄을 만든 블록이 함께 강조된다.
- 블록을 놓는 즉시(변경 이벤트 뒤 100ms 디바운스) 검사한다.
- 하단 패널은 `문제 | 콘솔` 탭이며 접을 수 있다. 계획 2C에서 콘솔은 보드 출력도 받는다.

## 4. 보드 연결 (계획 2C)

기준 문서 7장 그대로: `Device` 인터페이스, `WebSerialDevice`(115200, raw REPL), `FakeDevice`, 실행/보드에 저장/멈춤, 오류 안내 문구. 추가:
- "보드에 저장"은 레지스트리 `libFiles`로 사용 중인 장치의 라이브러리를 `public/lib/`에서 읽어 함께 올린다(이미 보드에 있으면 건너뛰도록 `os.listdir()`로 확인).
- 콘솔 탭에 보드 출력·`Traceback`을 그대로 보여 주고, `line N`을 잡아 코드 줄과 블록을 강조한다.
- 상단 버튼은 상태(끊김·연결됨·실행 중)를 아이콘·색으로 보여 준다(`Usb`, `Play`, `Save`, `Square`, 상태 배지).
- 검증은 실제 보드(Keyestudio ESP32 PLUS)를 Chrome에서 직접 연결해 수행한다.

## 5. 테스트

- 레지스트리 테스트: 모든 장치의 모든 블록이 "블록 → 코드 → 블록" 왕복을 통과하고 `unparsed`가 0 (계획 1의 toolbox-roundtrip 확장).
- 생성 코드 모양 테스트: 챕터 2~9 코드와 튜토리얼 핵심 줄(ADC/DHT/RFID/IR/키패드/LCD)을 기대 문자열로.
- 검사 규칙 단위 테스트(규칙당 오류 사례·정상 사례), 코드 지도 테스트.
- e2e: 스크롤바 사라짐, 좁은 화면 탭 전환, 값 비운 블록에 경고 아이콘과 문제 패널 항목, 항목 클릭 시 코드 줄 강조, 코드 모드 콘솔의 영어 문법 오류.
- 보드: FakeDevice 단위 테스트 + 실제 보드 수동 검증 기록.

## 6. 계획 분할

- **계획 2A**: 1장 + 2장 (정리, 레지스트리, 센서 블록, 라이브러리 동봉)
- **계획 2B**: 3장 (검사 엔진, 코드 지도, 문제·콘솔 패널, 양방향 이동)
- **계획 2C**: 4장 (보드 연결)

각 계획은 끝날 때마다 배포하고, 다음 계획은 실제 코드를 보고 작성한다.
