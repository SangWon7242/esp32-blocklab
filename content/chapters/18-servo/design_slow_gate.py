from machine import Pin, PWM
import time

servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)

for angle in range(91):
    servo.duty_u16(1638 + angle * 6462 // 180)
    time.sleep_ms(20)
time.sleep(3)
servo.duty_u16(1638 + 0 * 6462 // 180)
