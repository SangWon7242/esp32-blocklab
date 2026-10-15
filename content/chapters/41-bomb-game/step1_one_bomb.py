from machine import Pin, SoftI2C
import ssd1306
import time
import random

button_a = Pin(14, Pin.IN, Pin.PULL_UP)  # a 버튼: 누르면 0
button_b = Pin(27, Pin.IN, Pin.PULL_UP)  # b 버튼: 누르면 0
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))  # OLED 두 선 (SCL 22번, SDA 21번)
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

player = 2  # 플레이어 칸 번호 (0~4). 2번 칸에서 시작
bomb_x = random.randint(0, 4)  # 폭탄 칸 번호 (0~4) 아무 칸
bomb_y = 0  # 폭탄 줄 번호 (0 맨 위 ~ 4 맨 밑)
while True:
    if button_a.value() == 0:  # a 버튼: 칸 번호 1 줄이기
        player = player - 1
    if button_b.value() == 0:  # b 버튼: 칸 번호 1 늘리기
        player = player + 1
    oled.fill(0)
    oled.fill_rect(bomb_x * 25, bomb_y * 12, 25, 12, 1)  # 폭탄: 칸 폭 25, 높이 12
    oled.fill_rect(player * 25, 48, 25, 12, 1)  # 플레이어는 늘 맨 밑 줄 (y 48)
    oled.show()
    time.sleep(0.5)  # 0.5초마다 한 줄씩
    if bomb_y == 4:  # 맨 밑에 닿았으면 다시 맨 위로, 칸은 새로 뽑기
        bomb_y = 0
        bomb_x = random.randint(0, 4)
    else:
        bomb_y = bomb_y + 1
