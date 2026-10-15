from machine import Pin, SoftI2C, TouchPad
import ssd1306
import time
import random

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
touch_a = TouchPad(Pin(32))  # 호일 패드 a
touch_b = TouchPad(Pin(33))  # 호일 패드 b
touch_c = TouchPad(Pin(27))  # 호일 패드 c


def show_problem():  # 문제 리스트를 차례로 보여 주는 함수
    for n in problem:
        oled.fill(0)
        oled.text(names[n], 60, 28)
        oled.show()
        time.sleep(0.5)
        oled.fill(0)
        oled.show()
        time.sleep(0.2)


def pick(n):  # 만진 패드 번호 n 을 받아 두는 함수
    answer.append(n)
    oled.fill(0)
    oled.text(names[n], 60, 28)
    oled.show()
    while touch_a.read() < 300 or touch_b.read() < 300 or touch_c.read() < 300:
        time.sleep(0.05)  # 손을 뗄 때까지 기다리기
    oled.fill(0)
    oled.show()


names = ["A", "B", "C"]
problem = []
answer = []  # 빈 입력 리스트
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
    if len(answer) == len(problem):  # 입력이 문제만큼 모이면
        print(problem)
        print(answer)
        break
    time.sleep(0.05)
