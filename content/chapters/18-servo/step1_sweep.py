from machine import Pin, PWM
import time

servo = PWM(Pin(4))  # 서보 주황 신호선 → 4번
servo.freq(50)
servo.duty_u16(1638)

while True:
    servo.duty_u16(1638 + 0 * 6462 // 180)  # 0도
    time.sleep(1)
    servo.duty_u16(1638 + 90 * 6462 // 180)  # 90도
    time.sleep(1)
    servo.duty_u16(1638 + 180 * 6462 // 180)  # 180도
    time.sleep(1)
