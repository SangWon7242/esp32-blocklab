from machine import Pin, PWM
import time

beeper = PWM(Pin(25))
beeper.freq(440)
beeper.duty(0)

notes = [262, 262, 392, 392, 440, 440, 392]  # 도 도 솔 솔 라 라 솔
beats = [1, 1, 1, 1, 1, 1, 2]  # 마지막 솔은 두 박
for i in range(len(notes)):
    beeper.freq(notes[i])  # i번째 음을 i번째 박자만큼 (한 박 = 0.4초)
    beeper.duty(512)
    time.sleep(beats[i] * 0.4)
    beeper.duty(0)
    time.sleep(0.1)
