from machine import Pin, PWM
import time

motor1a = PWM(Pin(13))  # IN+ 를 PWM 으로 (세기 조절용)
motor1a.freq(1000)
motor1b = Pin(12, Pin.OUT)  # IN- 는 그대로

motor1b.value(0)  # 한 방향으로 고정
while True:
    motor1a.duty(300)  # 약한 바람
    time.sleep(3)
    motor1a.duty(1023)  # 센 바람
    time.sleep(3)
