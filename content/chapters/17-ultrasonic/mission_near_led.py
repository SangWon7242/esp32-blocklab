from machine import Pin
import time

trig = Pin(13, Pin.OUT)  # 13번 = 초음파를 쏘는 핀, 12번 = 메아리를 듣는 핀
echo = Pin(12, Pin.IN)
led = Pin(26, Pin.OUT)  # 26번 = 경고 LED


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
    d = get_distance()  # 거리를 재서 d 에 담기
    print(d, "cm")  # 숫자는 그대로 찍고
    if d < 15:  # 15cm 보다 가까우면
        led.value(1)  # LED 켜기
    else:
        led.value(0)  # 15cm 이상이면 LED 끄기
    time.sleep_ms(500)  # 0.5초마다 다시
