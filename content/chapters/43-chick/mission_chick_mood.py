from machine import Pin, SoftI2C
import ssd1306
import time
import dht

dht11 = dht.DHT11(Pin(13))
button = Pin(27, Pin.IN, Pin.PULL_UP)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

started = False
state = "BLANK"
oled.fill(0)
oled.text("You Like Chick?", 4, 20)
oled.text("PRESS START", 20, 40)
oled.show()
while True:
    if button.value() == 0:
        started = True
    if started:
        dht11.measure()
        t = dht11.temperature()
        h = dht11.humidity()
        if 20 <= t <= 28 and 40 <= h <= 70:
            state = "SMILE"
        else:
            state = "BAD"
        oled.fill(0)
        oled.text("S: " + state, 0, 0)
        oled.text("T: " + str(t) + "C", 0, 16)
        oled.text("H: " + str(h) + "%", 0, 32)
        oled.show()
        time.sleep(2)
    time.sleep(0.1)
