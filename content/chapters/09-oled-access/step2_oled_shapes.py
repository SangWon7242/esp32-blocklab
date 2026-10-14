from machine import Pin, SoftI2C
import ssd1306

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

oled.fill(0)  # 지우기
oled.line(0, 0, 127, 20, 1)  # 선 (시작 x, 시작 y, 끝 x, 끝 y, 켜기)
oled.rect(10, 30, 50, 25, 1)  # 네모 테두리 (x, y, 가로, 세로, 켜기)
oled.fill_rect(70, 30, 20, 20, 1)  # 꽉 채운 네모
oled.show()  # 화면에 나타내기
