from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)
led = Pin(2, Pin.OUT)


def on_press(pin):
    global pressed
    pressed = True  # 깃발만 세우고 바로 끝내요


pressed = False
button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)
while True:
    if pressed:
        if led.value() == 0:  # 꺼져 있었으면 켜고
            led.value(1)
        else:
            led.value(0)
        pressed = False
    time.sleep(0.05)
