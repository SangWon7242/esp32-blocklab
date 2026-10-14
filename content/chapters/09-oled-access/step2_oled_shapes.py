from machine import Pin, SoftI2C
import ssd1306
import gfx                                # 도형 그리기 설명서
import time

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

graphics = gfx.GFX(128, 64, oled.pixel)   # 도형 그리기 준비

oled.fill(0)                              # 지우기
graphics.line(0, 0, 127, 20, 1)           # 선 (시작x, 시작y, 끝x, 끝y, 켜기)
graphics.rect(10, 30, 50, 25, 1)          # 네모 테두리 (x, y, 가로, 세로)
graphics.fill_rect(70, 30, 20, 20, 1)     # 꽉 채운 네모
graphics.circle(110, 40, 10, 1)           # 동그라미 (중심x, 중심y, 반지름)
oled.show()                               # 화면에 나타내기
