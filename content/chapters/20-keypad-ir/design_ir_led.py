from machine import Pin
import time
from irrecvdata import irGetCMD

ir = irGetCMD(5)
led = Pin(2, Pin.OUT)

while True:
    value = ir.ir_read()
    if value == "0xff02fd":
        led.value(1)
    elif value:
        led.value(0)
    time.sleep(0.1)
