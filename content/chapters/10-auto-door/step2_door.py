from machine import Pin, PWM              # 서보를 쓰려고 PWM 도 추가
import time

trig = Pin(13, Pin.OUT)                   # 초음파를 쏘는 핀
echo = Pin(12, Pin.IN)                    # 메아리를 듣는 핀

servo = PWM(Pin(4))                       # 4번 핀의 서보 = 우리 문
servo.freq(50)                            # 서보는 1초에 50번 신호
servo.duty_u16(1638)                      # 처음엔 문을 닫아 두기


def get_distance():                       # ① 에서 만든 함수 그대로
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


time.sleep(2)                             # 센서 준비 2초

while True:
    d = get_distance()                    # 거리를 재서 d 에 담기
    if d < 15:                            # 15cm 보다 가까우면
        servo.duty_u16(8100)              # 문 열기
        time.sleep(3)                     # 3초 동안 열어 두기
        servo.duty_u16(1638)              # 다시 문 닫기
    time.sleep_ms(300)                    # 0.3초마다 다시 재기
