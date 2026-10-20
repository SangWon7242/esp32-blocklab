from machine import Pin, PWM
import time

red = PWM(Pin(27))  # 신호등 RGB LED: 빨강 27, 초록 25, 파랑 26
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)
beeper = PWM(Pin(16))  # 건너라는 소리를 낼 수동 부저
beeper.freq(440)
beeper.duty(0)
trig = Pin(13, Pin.OUT)  # 초음파 Trig 13, Echo 12
echo = Pin(12, Pin.IN)
servo = PWM(Pin(4))  # 차단기가 될 서보, 처음엔 0도
servo.freq(50)
servo.duty_u16(1638)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


def get_distance():
    trig.value(1)
    time.sleep_us(10)
    trig.value(0)
    while not echo.value():
        pass
    start = time.ticks_us()
    while echo.value():
        pass
    stop = time.ticks_us()
    t = time.ticks_diff(stop, start) // 2
    return int(340 * t // 10000)


time.sleep(2)
while True:
    d = get_distance()  # 여기부터 다섯 기능을 채워요
    time.sleep_ms(300)
