from machine import Pin, PWM
import time

beeper = PWM(Pin(25))
beeper.freq(440)
beeper.duty(0)

while True:
    for hz in range(400, 1000, 20):  # 20 Hz 씩 올라가기
        beeper.freq(hz)
        beeper.duty(512)
        time.sleep(0.01)
        beeper.duty(0)
    for hz in range(1000, 400, -20):  # 20 Hz 씩 내려가기
        beeper.freq(hz)
        beeper.duty(512)
        time.sleep(0.01)
        beeper.duty(0)
