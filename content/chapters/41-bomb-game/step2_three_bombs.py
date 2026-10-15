from machine import Pin, SoftI2C
import ssd1306
import time
import random

button_a = Pin(14, Pin.IN, Pin.PULL_UP)
button_b = Pin(27, Pin.IN, Pin.PULL_UP)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


def move_bomb(i):  # i 번 폭탄을 한 줄 내리는 함수
    global score
    global playing
    if bomb_y[i] == 4:  # 맨 밑에 닿았으면
        if bomb_x[i] == player:
            playing = False  # 맞음: 게임 끝
        else:
            score += 1  # 피함: 점수 1
        bomb_y[i] = 0
        bomb_x[i] = random.randint(0, 4)
    else:
        bomb_y[i] = bomb_y[i] + 1
    next_time[i] = time.ticks_ms() + random.randint(400, 900)  # 다음에 움직일 시각


player = 2
score = 0
playing = True
bomb_x = [0, 2, 4]  # 폭탄 세 개의 칸 번호
bomb_y = [0, 0, 0]  # 폭탄 세 개의 줄 번호
next_time = [0, 0, 0]  # 폭탄 세 개가 다음에 움직일 시각 (ms)
while playing:
    if button_a.value() == 0 and player > 0:
        player = player - 1
    if button_b.value() == 0 and player < 4:
        player = player + 1
    for i in range(3):
        if time.ticks_diff(time.ticks_ms(), next_time[i]) >= 0:  # 그 시각이 지났으면
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
