from machine import Pin, PWM, SoftI2C, ADC
import ssd1306
import time

light = ADC(Pin(36))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)
led = PWM(Pin(26))
led.freq(1000)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

while True:
    value = light.read()
    level = ((value - 3500) * (3 - 0) // (500 - 3500) + 0)
    print(value, level)
    time.sleep(0.5)
