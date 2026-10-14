from machine import Pin, PWM

pwm = PWM(Pin(26))
pwm.freq(10000)

pwm.duty(512)  # 0과 1023의 한가운데 = 절반 밝기
