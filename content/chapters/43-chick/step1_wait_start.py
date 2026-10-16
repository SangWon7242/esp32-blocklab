from machine import Pin, SoftI2C
import ssd1306
import time
import dht

dht11 = dht.DHT11(Pin(13))  # 온습도 센서 S 는 13번
button = Pin(27, Pin.IN, Pin.PULL_UP)  # 시작 버튼 (누르면 0)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

started = False  # 아직 시작 전
oled.fill(0)
oled.text("You Like Chick?", 4, 20)
oled.text("PRESS START", 20, 40)
oled.show()
while True:
    if button.value() == 0:  # 버튼을 누르면
        started = True  # 시작!
    if started:  # 시작한 뒤에만 재고 보여 줘요
        dht11.measure()
        t = dht11.temperature()
        h = dht11.humidity()
        oled.fill(0)
        oled.text("T: " + str(t) + "C", 0, 16)
        oled.text("H: " + str(h) + "%", 0, 32)
        oled.show()
        time.sleep(2)  # DHT11 은 한 번 잰 뒤 쉬어야 해요
    time.sleep(0.1)
