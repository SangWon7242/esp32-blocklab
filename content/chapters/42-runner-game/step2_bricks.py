from machine import Pin, SoftI2C
import ssd1306
import time
import random

button = Pin(14, Pin.IN, Pin.PULL_UP)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


def on_press(pin):
    global pressed
    pressed = True


def draw_hero(y):  # 디콘 그리기: 몸 하나 + 다리 두 장을 번갈아
    oled.fill_rect(8, y, 8, 12, 1)
    if distance % 2 == 0:
        oled.fill_rect(8, y + 12, 3, 4, 1)
    else:
        oled.fill_rect(13, y + 12, 3, 4, 1)


pressed = False
playing = False
blink = 0
bricks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]  # 벽돌 리스트 16칸: 1이면 벽돌
distance = 0  # 달린 거리 (프레임 수)
button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)
while True:
    if pressed:
        pressed = False
        playing = True
    oled.fill(0)
    if playing:
        new = 0
        if bricks[15] == 0 and random.randint(0, 2) == 0:  # 마지막 칸이 비었고, 1/3 확률이면
            new = 1
        bricks.pop(0)  # 0번 칸을 지우면 모두 번호가 1씩 줄어요 (디콘 쪽으로 한 칸)
        bricks.append(new)  # 새 칸은 맨 뒤(15번)에
        distance = distance + 1
        for i in range(16):
            if bricks[i] == 1:
                oled.fill_rect(i * 8, 48, 8, 8, 1)  # i번 칸 벽돌은 x = i × 8
        draw_hero(40)
        oled.text("SCORE " + str(distance // 8), 0, 0)  # 점수 = 거리 ÷ 8 (몫)
    elif blink % 10 < 5:
        oled.text("PRESS START", 20, 28)
    else:
        oled.fill_rect(8, 40, 8, 16, 1)
    oled.line(0, 56, 127, 56, 1)
    oled.show()
    blink = blink + 1
    time.sleep_ms(100)
