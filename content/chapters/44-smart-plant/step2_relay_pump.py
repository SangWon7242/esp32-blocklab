from machine import Pin, SoftI2C, ADC
import ssd1306
import time

soil = ADC(Pin(34))
soil.atten(ADC.ATTN_11DB)
soil.width(ADC.WIDTH_12BIT)
water = ADC(Pin(35))
water.atten(ADC.ATTN_11DB)
water.width(ADC.WIDTH_12BIT)
relay = Pin(26, Pin.OUT)  # 릴레이 S → 26번. 1 을 보내면 펌프가 돌아요
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

while True:
    s = soil.read()
    w = water.read()
    print("SOIL: " + str(s) + " WATER: " + str(w))
    oled.fill(0)
    oled.text("SOIL: " + str(s), 0, 0)
    oled.text("WATER: " + str(w), 0, 16)
    if s < 1500:  # 기준보다 작으면 흙이 마른 것
        oled.text("DRY", 0, 32)
        relay.value(1)
    else:
        oled.text("OK", 0, 32)
        relay.value(0)
    oled.show()
    time.sleep(1)
