from machine import Pin, SoftI2C, ADC
import ssd1306
import time

soil = ADC(Pin(34))  # 토양 수분 센서 S → 34번. 뒤에 WiFi 를 쓸 거라 아날로그는 32~39번
soil.atten(ADC.ATTN_11DB)
soil.width(ADC.WIDTH_12BIT)
water = ADC(Pin(35))  # 수위 센서 S → 35번
water.atten(ADC.ATTN_11DB)
water.width(ADC.WIDTH_12BIT)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

while True:
    s = soil.read()  # 흙 값: 촉촉할수록 커요
    w = water.read()  # 물통 값: 물이 많을수록 커요
    print("SOIL: " + str(s) + " WATER: " + str(w))
    oled.fill(0)
    oled.text("SOIL: " + str(s), 0, 0)
    oled.text("WATER: " + str(w), 0, 16)
    oled.show()
    time.sleep(1)
