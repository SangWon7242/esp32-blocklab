from machine import Pin, PWM
import time

servo = PWM(Pin(4))  # IO4 를 서보용으로 (서보는 1초에 50번 신호)
servo.freq(50)

while True:  # 계속 반복
    servo.duty_u16(1638)  # 닫힌 자리
    time.sleep(2)  # 2초 기다리기
    servo.duty_u16(8100)  # 열린 자리
    time.sleep(2)
