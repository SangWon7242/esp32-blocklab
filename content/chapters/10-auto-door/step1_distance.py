from machine import Pin                   # 핀 기능 가져오기
import time                               # 시간 기능 가져오기

trig = Pin(13, Pin.OUT)                   # 13번 = 초음파를 쏘는 핀
echo = Pin(12, Pin.IN)                    # 12번 = 메아리를 듣는 핀


def get_distance():                       # 거리를 재서 알려 주는 함수
    trig.value(1)                         # 초음파 쏘기 시작
    time.sleep_us(10)                     # 아주 짧게 10마이크로초만
    trig.value(0)                         # 그만 쏘기
    while not echo.value():               # 신호가 시작될 때까지
        pass                              # 그냥 기다리기
    start = time.ticks_us()               # 시작한 시간 적어 두기
    while echo.value():                   # 메아리가 돌아올 때까지
        pass                              # 또 기다리기
    stop = time.ticks_us()                # 돌아온 시간 적어 두기
    t = time.ticks_diff(stop, start)      # 두 시간의 차이 = 다녀온 시간
    t = t // 2                            # 왕복이니까 절반만 (가는 시간)
    return int(340 * t // 10000)          # 소리 속도를 곱해 cm 로 바꾸기


time.sleep(2)                             # 센서가 깨어날 시간 2초

while True:                               # 계속 반복
    print(get_distance(), "cm")           # 거리를 재서 창에 찍기
    time.sleep_ms(500)                    # 0.5초 쉬고 다시
