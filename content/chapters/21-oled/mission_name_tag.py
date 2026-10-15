from machine import Pin, SoftI2C
import ssd1306
import time

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

count = 0
while True:
    oled.fill(0)
    oled.rect(0, 0, 128, 64, 1)
    oled.text("HELLO, I AM", 8, 10)
    oled.text("MINJI", 8, 26)
    oled.text(str(count), 8, 44)
    oled.show()
    count = count + 1
    time.sleep(1)
