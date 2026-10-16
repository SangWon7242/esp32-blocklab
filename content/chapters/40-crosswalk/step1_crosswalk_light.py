from machine import Pin, PWM
import time

red = PWM(Pin(27))  # 신호등이 될 RGB LED: 빨강 27, 초록 25, 파랑 26
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)
trig = Pin(13, Pin.OUT)  # 13번 = 초음파를 쏘는 핀, 12번 = 메아리를 듣는 핀
echo = Pin(12, Pin.IN)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


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


time.sleep(2)  # 센서가 깨어날 시간 2초
while True:
    d = get_distance()  # 보행자까지의 거리를 재서 d 에 담기
    print(d, "cm")
    if d < 10:  # 10cm 보다 가까우면 = 보행자가 왔다
        set_color(0, 255, 0)  # 초록불
    else:
        set_color(255, 0, 0)  # 빨간불
    time.sleep_ms(300)  # 0.3초마다 다시 재기
