from machine import Pin, PWM              # 핀과 PWM 기능
import time                               # 시간 기능

servo = PWM(Pin(4))                       # IO4를 서보용으로
servo.freq(50)                            # 서보는 1초에 50번 신호

while True:                               # 계속 반복
    servo.duty_u16(1638)                  # 닫힌 자리
    time.sleep(2)                         # 2초 기다리기
    servo.duty_u16(8100)                  # 열린 자리
    time.sleep(2)
