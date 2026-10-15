from machine import Pin, SoftI2C
import ssd1306
import time
import random

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))  # OLED 두 선 (SCL 22번, SDA 21번)
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

names = ["A", "B", "C"]  # 0번 칸 A, 1번 칸 B, 2번 칸 C
problem = []  # 빈 문제 리스트
for i in range(3):
    problem.append(random.randint(0, 2))  # 0~2 가운데 하나를 맨 뒤에 넣기
print(problem)
for n in problem:  # 문제 리스트에서 앞에서부터 하나씩 꺼내기
    oled.fill(0)
    oled.text(names[n], 60, 28)
    oled.show()
    time.sleep(0.5)
    oled.fill(0)  # 같은 글자가 이어 나와도 알아보게 잠깐 비우기
    oled.show()
    time.sleep(0.2)
