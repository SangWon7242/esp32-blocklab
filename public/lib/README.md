# 보드 라이브러리 (MicroPython)

ESP32 에 함께 올려야 하는 장치 라이브러리 파일입니다. 블록랩이 만든 코드가 `import` 하는 모듈이 보드에 없으면 실행되지 않으므로,
보드 연결(계획 2C)이 작업판에 쓰인 준비 블록을 보고 필요한 파일만 골라 보드에 올립니다 (`src/devices/registry.ts` 의 `libFilesFor()`).
배포된 사이트에서는 `lib/<파일 이름>` 주소로 받을 수 있습니다.

## 출처

Keyestudio KS5020 키트 자료의 `Library.zip` 안 `Library/MicroPython_Library/` 폴더를 내려받은 그대로(줄 끝 CRLF 포함) 옮겼습니다.

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

장치 선언(`src/devices/specs/*.ts`)의 `libFiles` 에 적은 이름은 모두 이 폴더에 있어야 합니다 (`src/devices/libfiles.test.ts` 가 확인합니다).
라이브러리를 바꿀 때는 위 주소의 새 묶음에서 같은 폴더를 다시 옮기고 이 표를 고칩니다.
