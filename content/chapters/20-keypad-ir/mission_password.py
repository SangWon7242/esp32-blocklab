import time
from keypad import KeyPad

keypad = KeyPad(26, 25, 17, 16, 27, 14, 12, 13)

answer = ["2", "0", "2", "6"]
keys = []
while True:
    key = keypad.scan()
    if key:
        print(key)
        keys.append(key)
        time.sleep(0.3)
    if len(keys) == 4:
        if keys == answer:
            print("OK")
        else:
            print("NO")
        keys = []
    time.sleep(0.1)
