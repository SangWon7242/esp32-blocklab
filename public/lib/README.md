# 보드 라이브러리 (MicroPython)

ESP32 에 함께 올려야 하는 장치 라이브러리 파일입니다. 블록랩이 만든 코드가 `import` 하는 모듈이 보드에 없으면 실행되지 않으므로,
보드 연결(계획 2C)이 작업판에 쓰인 준비 블록을 보고 필요한 파일만 골라 보드에 올립니다 (`src/devices/registry.ts` 의 `libFilesFor()`).
배포된 사이트에서는 `lib/<파일 이름>` 주소로 받을 수 있습니다.

## 출처

`blocklab_net.py`·`blocklab_rfid.py` 는 블록랩이 직접 만든 도우미 모음입니다 (아래 표). 나머지는 Keyestudio KS5020 키트 자료의 `Library.zip` 안 `Library/MicroPython_Library/` 폴더를 내려받은 그대로(줄 끝 CRLF 포함) 옮겼습니다.

- https://docs.keyestudio.com/projects/KS5020/en/latest/_downloads/aa55cec3f54bf29d6d697256c354e3bd/Library.zip
- 가져온 날: 2026-10-14

## 파일

| 파일 | 쓰는 장치 (준비 블록) | 하는 일 |
| --- | --- | --- |
| `ssd1306.py` | OLED (`esp_oled_setup`) | SSD1306 OLED 드라이버 (`import ssd1306`) |
| `gfx.py` | — | 도형 그리기 도우미. 지금 블록은 쓰지 않지만 같은 묶음이라 함께 둡니다 |
| `lcd128_32.py` | LCD 128×32 (`dev_lcd_setup`) | LCD 드라이버 (`from lcd128_32 import lcd128_32`) |
| `lcd128_32_fonts.py` | LCD 128×32 (`dev_lcd_setup`) | LCD 글꼴 (`import lcd128_32_fonts`) |
| `mfrc522_i2c.py` | RFID (`dev_rfid_setup`) | MFRC522 RFID 리더 (I2C) (`from mfrc522_i2c import mfrc522`) |
| `mfrc522_config.py` | RFID (`dev_rfid_setup`) | MFRC522 레지스터·상수 (`mfrc522_i2c.py` 가 가져옴) |
| `soft_iic.py` | RFID (`dev_rfid_setup`) | 소프트웨어 I2C (`mfrc522_i2c.py` 가 가져옴) |
| `keypad.py` | 4×4 키패드 (`dev_keypad_setup`) | 키패드 읽기 (`from keypad import KeyPad`) |
| `irrecvdata.py` | IR 리모컨 (`dev_ir_setup`) | IR 수신 신호 풀이 (`from irrecvdata import irGetCMD`) |
| `blocklab_net.py` | WiFi (`dev_wifi_connect`·`dev_wifi_ap`)·웹서버 (`dev_web_setup`) | 블록랩 통신 도우미: `wifi_connect`·`wifi_ap`·`web_start`·`web_accept`·`web_send`·`web_send_file`·`web_page` (`from blocklab_net import *`) |
| `blocklab_rfid.py` | RFID (`dev_rfid_setup`) | 블록랩 RFID 도우미: `card_present(reader)`·`card_uid(reader)` (`from blocklab_rfid import *`) |

## 라이선스

- `blocklab_net.py`·`blocklab_rfid.py`: 블록랩 저장소의 코드입니다. 함수 이름 목록은 `src/devices/specs/net.ts`(NET_LIB_NAMES)·
  `src/devices/specs/input.ts`(RFID_LIB_NAMES)와 같아야 합니다 (`net.test.ts`·`input.test.ts` 가 확인합니다).
- `gfx.py`: 파일 머리말에 MIT License 라고 적혀 있습니다 (Adafruit GFX 를 옮긴 것, Tony DiCola).
- `ssd1306.py`: MicroPython 공식 저장소(micropython-lib, MIT 라이선스)의 SSD1306 드라이버입니다(2026-10-14 교체).
  Keyestudio 판은 framebuf 를 상속하지 않아 `line`/`rect` 가 없었고, 그래서 선·네모 블록이 보드에서 AttributeError 를 냈습니다.
- 그 밖의 Keyestudio 파일(`lcd128_32.py`, `lcd128_32_fonts.py`, `mfrc522_i2c.py`, `mfrc522_config.py`, `soft_iic.py`,
  `keypad.py`, `irrecvdata.py`)에는 라이선스 머리말이 없습니다. 다시 배포해도 되는지 만든 곳(Keyestudio)에 확인하는 중이며,
  답을 받기 전까지는 수업용으로만 함께 둡니다.

장치 선언(`src/devices/specs/*.ts`)의 `libFiles` 에 적은 이름은 모두 이 폴더에 있어야 합니다 (`src/devices/libfiles.test.ts` 가 확인합니다).
라이브러리를 바꿀 때는 위 주소의 새 묶음에서 같은 폴더를 다시 옮기고 이 표를 고칩니다.
