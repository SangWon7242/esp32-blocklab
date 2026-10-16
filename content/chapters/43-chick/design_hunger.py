from machine import Pin, SoftI2C
import ssd1306
import time

button = Pin(27, Pin.IN, Pin.PULL_UP)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

food = 5
oled.fill(0)
oled.text("FEED ME", 36, 28)
oled.show()
time.sleep(1)
last = time.ticks_ms()
while True:
    if button.value() == 0:
        food = min(food + 1, 10)
        time.sleep(0.3)
    if time.ticks_diff(time.ticks_ms(), last) > 10000:
        food = max(food - 1, 0)
        last = time.ticks_ms()
    oled.fill(0)
    oled.text("FOOD: " + str(food), 0, 0)
    oled.fill_rect(0, 20, food * 12, 12, 1)
    if food < 3:
        oled.text("HUNGRY!", 0, 44)
    oled.show()
    time.sleep(0.1)
