from machine import Pin, SoftI2C
import ssd1306

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

oled.fill(0)
oled.text("MY HOUSE", 32, 0)
oled.line(36, 30, 64, 12, 1)
oled.line(64, 12, 92, 30, 1)
oled.rect(40, 30, 48, 32, 1)
oled.fill_rect(58, 44, 12, 18, 1)
oled.rect(46, 36, 8, 8, 1)
oled.rect(74, 36, 8, 8, 1)
oled.show()
