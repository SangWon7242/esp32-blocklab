import time
from keypad import KeyPad

keypad = KeyPad(26, 25, 17, 16, 27, 14, 12, 13)  # 행 핀 4개, 열 핀 4개

while True:
    key = keypad.scan()  # 눌린 키 (안 눌렸으면 None)
    if key:
        print(key)
    time.sleep(0.1)
