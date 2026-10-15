from machine import Pin, SoftI2C
import ssd1306
import time
import random

button_a = Pin(14, Pin.IN, Pin.PULL_UP)
button_b = Pin(27, Pin.IN, Pin.PULL_UP)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

player = 2
bomb_x = random.randint(0, 4)
bomb_y = 0
score = 0  # 피한 폭탄 개수
while True:
    if button_a.value() == 0 and player > 0:  # 0번 칸에서는 더 줄이지 않기
        player = player - 1
    if button_b.value() == 0 and player < 4:  # 4번 칸에서는 더 늘리지 않기
        player = player + 1
    oled.fill(0)
    oled.fill_rect(bomb_x * 25, bomb_y * 12, 25, 12, 1)
    oled.fill_rect(player * 25, 48, 25, 12, 1)
    oled.show()
    time.sleep(0.5)
    if bomb_y == 4:
        if bomb_x == player:  # 같은 칸이면 맞은 것
            oled.fill(0)
            oled.text("END", 52, 20)
            oled.text("SCORE " + str(score), 32, 36)
            oled.show()
            break
        score = score + 1  # 피했으면 점수 1
        bomb_y = 0
        bomb_x = random.randint(0, 4)
    else:
        bomb_y = bomb_y + 1
