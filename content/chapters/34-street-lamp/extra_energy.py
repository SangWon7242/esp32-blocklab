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

names = ["DARK", "DIM", "MEDIUM", "BRIGHT"]
total = 0
count = 0
while True:
    value = light.read()
    level = ((value - 3500) * (3 - 0) // (500 - 3500) + 0)
    power = ((level - 0) * (0 - 100) // (3 - 0) + 100)
    led.duty(int(power * 1023 / 100))
    total = total + power
    count = count + 1
    oled.fill(0)
    oled.text(names[level], 0, 0)
    oled.text("LED " + str(power) + "%", 0, 20)
    oled.text("SAVE " + str(100 - total // count) + "%", 0, 40)
    oled.show()
    time.sleep(0.5)
