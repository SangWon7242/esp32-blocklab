# 추가 미션 1 · 문이 열리면 LED도 같이 켜기
# 배선: IO26 → 220Ω → LED 긴 다리 / LED 짧은 다리 → GND

from machine import Pin, PWM, SoftI2C
import ssd1306
import time

trig = Pin(13, Pin.OUT)
echo = Pin(12, Pin.IN)
led = Pin(26, Pin.OUT)                    # ★ LED 핀 하나 더 만들기

servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


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
show("AUTO DOOR", "Come closer")

while True:
    d = get_distance()
    if d < 15:
        show("DOOR OPEN", "Welcome")
        servo.duty_u16(8100)              # 문 열기
        led.value(1)                      # ★ 문이 열리면 LED 켜기
        time.sleep(3)
        show("DOOR CLOSE", "Bye~")
        servo.duty_u16(1638)              # 문 닫기
        led.value(0)                      # ★ 문이 닫히면 LED 끄기
        time.sleep(1)
        show("AUTO DOOR", "Come closer")
    time.sleep_ms(300)
