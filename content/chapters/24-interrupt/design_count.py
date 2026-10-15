from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)


def on_press(pin):
    global count
    count += 1


count = 0
button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)
while True:
    print(count)
    time.sleep(1)
