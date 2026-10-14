from machine import Pin, SoftI2C          # 핀과 I2C 기능
import ssd1306                            # OLED 설명서
import time

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))   # 화면이 쓸 선 정하기
oled = ssd1306.SSD1306_I2C(128, 64, i2c)  # 128×64 화면 준비

oled.fill(0)                              # 화면을 까맣게 지우기
oled.text("Hello, ESP32!", 0, 0)          # (0, 0) 자리에 적어 두기
oled.text("Smart Door", 0, 20)            # (0, 20) 자리에
oled.text("Ready", 0, 40)                 # (0, 40) 자리에
oled.show()                               # 이제 화면에 나타남
