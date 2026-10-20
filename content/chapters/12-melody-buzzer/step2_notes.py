from machine import Pin, PWM
import time

beeper = PWM(Pin(25))  # 수동 부저를 25번 핀에, 처음에는 조용히
beeper.freq(440)
beeper.duty(0)

notes = [262, 294, 330, 349, 392, 440, 494, 523]  # 도 레 미 파 솔 라 시 도
for hz in notes:
    beeper.freq(hz)  # 떨림 빠르기(음 높이)를 정하고 0.4초 울리기
    beeper.duty(512)
    time.sleep(0.4)
    beeper.duty(0)
    time.sleep(0.1)  # 음과 음 사이 쉼
