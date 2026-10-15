from machine import Pin
import time

trig = Pin(13, Pin.OUT)
echo = Pin(12, Pin.IN)
led = Pin(26, Pin.OUT)


def get_distance():
    trig.value(1)
    time.sleep_us(10)
    trig.value(0)
    while not echo.value():
        pass
    start = time.ticks_us()
    while echo.value():
        pass
    stop = time.ticks_us()
    t = time.ticks_diff(stop, start) // 2
    return int(340 * t // 10000)


time.sleep(2)
while True:
    d = get_distance()
    print(d, "cm")
    if d < 10:
        led.value(1)
    elif d < 30:
        led.value(1)
        time.sleep_ms(100)
        led.value(0)
    else:
        led.value(0)
    time.sleep_ms(300)
