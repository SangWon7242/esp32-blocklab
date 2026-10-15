from machine import Pin, TouchPad
import time

touch_a = TouchPad(Pin(32))
touch_b = TouchPad(Pin(33))
touch_c = TouchPad(Pin(27))

while True:
    print(touch_a.read())
    print(touch_b.read())
    print(touch_c.read())
    print("---")
    time.sleep(0.5)
