from machine import Pin, SoftI2C
import ssd1306

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))  # 화면이 쓸 선 정하기 (SCL 22번, SDA 21번)
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

oled.fill(0)  # 화면을 까맣게 지우기
oled.text("Hello, ESP32!", 0, 0)  # (0, 0) 자리에 적어 두기
oled.text("Smart Door", 0, 20)  # (0, 20) 자리에
oled.text("Ready", 0, 40)  # (0, 40) 자리에
oled.show()  # 이제 화면에 나타남
