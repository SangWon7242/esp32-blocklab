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


def draw_hero(y):
    oled.fill_rect(8, y, 8, 12, 1)
    if distance % 2 == 0:
        oled.fill_rect(8, y + 12, 3, 4, 1)
    else:
        oled.fill_rect(13, y + 12, 3, 4, 1)


pressed = False
playing = False
blink = 0
bricks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
distance = 0
jump = 0
best = 0
button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)
while True:
    oled.fill(0)
    if playing:
        if jump > 0:
            jump = jump + 1
            if jump > 2:
                jump = 0
        if pressed:
            pressed = False
            if jump == 0:
                jump = 1
        new = 0
        if bricks[15] == 0 and random.randint(0, 2) == 0:
            new = 1
        bricks.pop(0)
        bricks.append(new)
        distance = distance + 1
        if bricks[1] == 1 and jump == 0:
            playing = False
            score = distance // 8
            if score > best:
                best = score
            oled.text("GAME OVER", 28, 12)
            oled.text("SCORE " + str(score), 28, 28)
            oled.text("BEST " + str(best), 28, 44)
            oled.show()
            time.sleep(2)
            pressed = False
        else:
            for i in range(16):
                if bricks[i] == 1:
                    oled.fill_rect(i * 8, 48, 8, 8, 1)
            draw_hero(40 - jump * 8)
            oled.text("SCORE " + str(distance // 8), 0, 0)
    else:
        if pressed:
            pressed = False
            playing = True
            distance = 0
            jump = 0
            bricks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        if blink % 10 < 5:
            oled.text("PRESS START", 20, 28)
        else:
            oled.fill_rect(8, 40, 8, 16, 1)
    oled.line(0, 56, 127, 56, 1)
    oled.show()
    blink = blink + 1
    wait = max(40, 100 - distance // 20)
    time.sleep_ms(wait)
