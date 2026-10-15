from machine import Pin, PWM, SoftI2C
import ssd1306
import time
import dht

dht11 = dht.DHT11(Pin(4))
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
red = PWM(Pin(27))
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


while True:
    dht11.measure()
    t = dht11.temperature()
    h = dht11.humidity()
    di = 0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3  # 불쾌지수 식
    oled.fill(0)
    oled.text("T: " + str(t) + "C", 0, 16)
    oled.text("H: " + str(h) + "%", 0, 32)
    oled.text("DI: " + str(int(di)), 0, 48)  # 소수점을 버리고 정수로 보여요
    oled.show()
    if di >= 80:
        set_color(255, 0, 0)  # 빨강: 매우 높음
    elif di >= 75:
        set_color(255, 128, 0)  # 주황: 높음
    elif di >= 68:
        set_color(255, 255, 0)  # 노랑: 보통
    else:
        set_color(0, 255, 0)  # 초록: 쾌적
    time.sleep(2)
