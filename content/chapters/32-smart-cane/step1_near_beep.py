from machine import Pin, PWM
import time

trig = Pin(13, Pin.OUT)  # 13번 = 초음파를 쏘는 핀, 12번 = 메아리를 듣는 핀
echo = Pin(12, Pin.IN)
beeper = PWM(Pin(15))  # 수동 부저를 15번 핀에, 처음에는 조용히
beeper.freq(440)
beeper.duty(0)


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
    print(d, "cm")
    if d < 30:  # 30cm 보다 가까우면
        beeper.freq(880)  # 880 Hz 로 0.1초 삐
        beeper.duty(512)
        time.sleep(0.1)
        beeper.duty(0)
        time.sleep(0.3)  # 삐와 삐 사이는 늘 0.3초
    time.sleep(0.1)
