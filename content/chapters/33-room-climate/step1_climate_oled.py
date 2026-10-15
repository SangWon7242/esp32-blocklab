from machine import Pin, SoftI2C
import ssd1306
import time
import dht

dht11 = dht.DHT11(Pin(4))  # 팬이 13번을 쓰니 DHT11 은 4번 핀에
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

while True:
    dht11.measure()  # 지금 온도와 습도를 새로 재요
    t = dht11.temperature()
    h = dht11.humidity()
    oled.fill(0)
    oled.text("T: " + str(t) + "C", 0, 16)  # 숫자 t 를 글자로 바꿔 이어 붙여요
    oled.text("H: " + str(h) + "%", 0, 32)
    oled.show()  # 적어 둔 두 줄을 화면에 내보내요
    time.sleep(2)
