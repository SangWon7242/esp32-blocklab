from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)
led = Pin(2, Pin.OUT)


def on_press(pin):
    global reaction
    if reaction == 0:  # 처음 누른 것만 재요
        reaction = time.ticks_diff(time.ticks_ms(), start)


start = 0
reaction = 0
button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)
while True:
    time.sleep(3)
    reaction = 0
    led.value(1)
    start = time.ticks_ms()
    time.sleep(2)
    led.value(0)
    print(reaction)
