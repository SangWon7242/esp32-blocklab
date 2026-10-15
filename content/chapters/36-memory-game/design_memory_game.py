from machine import Pin, SoftI2C, TouchPad
import ssd1306
import time
import random

button = Pin(14, Pin.IN, Pin.PULL_UP)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
touch_a = TouchPad(Pin(32))
touch_b = TouchPad(Pin(33))
touch_c = TouchPad(Pin(27))


def show_problem():
    for n in problem:
        oled.fill(0)
        oled.text(names[n], 60, 28)
        oled.show()
        time.sleep(0.5)
        oled.fill(0)
        oled.show()
        time.sleep(0.2)


def pick(n):
    answer.append(n)
    oled.fill(0)
    oled.text(names[n], 60, 28)
    oled.show()
    while touch_a.read() < 300 or touch_b.read() < 300 or touch_c.read() < 300:
        time.sleep(0.05)
    oled.fill(0)
    oled.show()


names = ["A", "B", "C"]
problem = []
answer = []
score = 0
oled.fill(0)
oled.text("PRESS START", 20, 28)
oled.show()
while button.value() == 1:
    time.sleep(0.05)
for i in range(3):
    problem.append(random.randint(0, 2))
show_problem()
while True:
    if touch_a.read() < 300:
        pick(0)
    elif touch_b.read() < 300:
        pick(1)
    elif touch_c.read() < 300:
        pick(2)
    if len(answer) == len(problem):
        correct = 0
        for i in range(len(problem)):
            if answer[i] == problem[i]:
                correct += 1
        oled.fill(0)
        if correct == len(problem):
            oled.text("OK", 56, 28)
            oled.show()
            score += 1
            answer.clear()
            problem.append(random.randint(0, 2))
            time.sleep(1)
            show_problem()
        else:
            oled.text("END", 52, 20)
            oled.text("SCORE " + str(score), 32, 36)
            oled.show()
            break
    time.sleep(0.05)
