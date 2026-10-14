from machine import Pin, SoftI2C
import ssd1306
import time

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


def show(a, b):
    oled.fill(0)
    oled.text(a, 0, 20)
    oled.text(b, 0, 36)
    oled.show()


show("SMART DOOR", "Hello!")
time.sleep(2)
oled.fill(0)
oled.rect(0, 0, 128, 64, 1)
oled.text("SMART DOOR", 24, 12)
oled.line(0, 30, 127, 30, 1)
oled.text("Tag your card", 12, 44)
oled.show()
