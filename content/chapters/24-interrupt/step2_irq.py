from machine import Pin
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)
led = Pin(2, Pin.OUT)


def on_press(pin):
    print("눌렸다!")  # 누르는 순간 바로 불려요


button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)
while True:
    led.value(1)
    time.sleep(2)
    led.value(0)
    time.sleep(2)
