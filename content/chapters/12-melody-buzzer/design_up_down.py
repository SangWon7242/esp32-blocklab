from machine import Pin, PWM
import time

beeper = PWM(Pin(25))
beeper.freq(440)
beeper.duty(0)

notes = [262, 294, 330, 349, 392, 440, 494, 523]
for hz in notes:
    beeper.freq(hz)
    beeper.duty(512)
    time.sleep(0.3)
    beeper.duty(0)
for hz in reversed(notes):
    beeper.freq(hz)
    beeper.duty(512)
    time.sleep(0.3)
    beeper.duty(0)
