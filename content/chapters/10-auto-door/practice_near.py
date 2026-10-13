# 1부 연습 미션 정답 · 가까이 오면 알려 주기
# 아직 문도 화면도 없습니다. print 로만 판단을 연습합니다.

from machine import Pin                   # 핀 기능 가져오기
import time                               # 시간 기능 가져오기

trig = Pin(13, Pin.OUT)                   # 13번 = 초음파를 쏘는 핀
echo = Pin(12, Pin.IN)                    # 12번 = 메아리를 듣는 핀


def get_distance():                       # step1 에서 만든 함수 그대로
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


time.sleep(2)                             # 센서가 깨어날 시간 2초

while True:
    d = get_distance()                    # 거리를 재서 d 에 담기
    print(d, "cm")                        # 숫자는 그대로 찍고
    if d < 15:                            # 15cm 보다 가까우면
        print("가까워요!")                 # 이 말도 함께 찍기
    time.sleep_ms(500)                    # 0.5초마다 다시
