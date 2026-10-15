from machine import Pin, PWM, SoftI2C
import ssd1306
import time
import random

trig = Pin(13, Pin.OUT)
echo = Pin(12, Pin.IN)
servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)
button = Pin(14, Pin.IN, Pin.PULL_UP)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
beeper = PWM(Pin(15))  # 15번 = 수동 부저
beeper.freq(440)
beeper.duty(0)


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


def show(a, b):
    oled.fill(0)
    oled.text(a, 0, 20)
    oled.text(b, 0, 36)
    oled.show()


time.sleep(2)
show("HAMMER", "Hand + Button")
while True:
    d = get_distance()
    if button.value() == 0 and d <= 20:
        num = random.randint(1, 2)
        if num == 1:
            show("WIN", str(d) + " cm")
            servo.duty_u16(1638 + 90 * 6462 // 180)
            beeper.freq(880)  # 당첨: 높은 소리
            beeper.duty(512)
            time.sleep(0.3)
            beeper.duty(0)
        elif num == 2:
            show("FAIL", str(d) + " cm")
            servo.duty_u16(1638 + 50 * 6462 // 180)
            beeper.freq(220)  # 꽝: 낮은 소리
            beeper.duty(512)
            time.sleep(0.6)
            beeper.duty(0)
        time.sleep(1)
        show("HAMMER", "Hand + Button")
    servo.duty_u16(1638 + 180 * 6462 // 180)
    time.sleep_ms(100)
