from machine import Pin, PWM, ADC
import time

trig = Pin(13, Pin.OUT)
echo = Pin(12, Pin.IN)
beeper = PWM(Pin(15))
beeper.freq(440)
beeper.duty(0)
led = Pin(26, Pin.OUT)
light = ADC(Pin(36))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)
tilt = Pin(14, Pin.IN)


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


def check_distance():
    d = get_distance()
    if d < 30:
        beeper.freq(880)
        beeper.duty(512)
        time.sleep(0.1)
        beeper.duty(0)
        time.sleep_ms(((d - 0) * (500 - 50) // (30 - 0) + 50))


def check_light():
    if light.read() > 2500:
        led.value(1)
        time.sleep(0.1)
        led.value(0)


def check_tilt():
    if tilt.value() == 1:
        beeper.freq(1319)
        beeper.duty(512)
        time.sleep(0.25)
        beeper.duty(0)


time.sleep(2)
while True:
    check_distance()
    check_light()
    check_tilt()
    time.sleep(0.1)
