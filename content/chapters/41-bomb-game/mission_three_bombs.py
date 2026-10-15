from machine import Pin, SoftI2C
import ssd1306
import time
import random

button_a = Pin(14, Pin.IN, Pin.PULL_UP)
button_b = Pin(27, Pin.IN, Pin.PULL_UP)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


def move_bomb(i):
    global score
    global playing
    if bomb_y[i] == 4:
        if bomb_x[i] == player:
            playing = False
        else:
            score += 1
        bomb_y[i] = 0
        bomb_x[i] = random.randint(0, 4)
    else:
        bomb_y[i] = bomb_y[i] + 1
    gap = 900 - score * 50  # 점수가 오르면 간격이 줄어듦
    if gap < 200:  # 200ms 보다 짧아지지 않게
        gap = 200
    next_time[i] = time.ticks_ms() + random.randint(200, gap)


player = 2
score = 0
playing = True
bomb_x = [0, 2, 4]
bomb_y = [0, 0, 0]
next_time = [0, 0, 0]
while playing:
    if button_a.value() == 0 and player > 0:
        player = player - 1
    if button_b.value() == 0 and player < 4:
        player = player + 1
    for i in range(3):
        if time.ticks_diff(time.ticks_ms(), next_time[i]) >= 0:
            move_bomb(i)
    oled.fill(0)
    for i in range(3):
        oled.fill_rect(bomb_x[i] * 25, bomb_y[i] * 12, 25, 12, 1)
    oled.fill_rect(player * 25, 48, 25, 12, 1)
    oled.show()
    time.sleep(0.1)
oled.fill(0)
oled.text("END", 52, 20)
oled.text("SCORE " + str(score), 32, 36)
oled.show()
