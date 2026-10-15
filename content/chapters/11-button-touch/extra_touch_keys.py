from machine import Pin, TouchPad
import time

key1 = TouchPad(Pin(4))
key2 = TouchPad(Pin(27))

while True:
    if key1.read() < 300:
        print("도")
    elif key2.read() < 300:
        print("레")
    time.sleep(0.2)
