from machine import Pin, SoftI2C
import ssd1306
import time

button = Pin(14, Pin.IN, Pin.PULL_UP)  # 점프 버튼: 떼면 1, 누르면 0
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))  # OLED 두 선 (SCL 22번, SDA 21번)
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


def on_press(pin):  # 버튼을 누르는 순간 끼어드는 함수
    global pressed
    pressed = True  # 깃발만 세우고 바로 끝


pressed = False  # 깃발: 처음엔 내려져 있어요
playing = False  # 게임 중인가
blink = 0  # 프레임을 세는 수
button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)
while True:
    if pressed:  # 깃발이 올라와 있으면
        pressed = False  # 반복이 깃발을 내리고
        playing = True  # 게임을 시작해요
    oled.fill(0)
    if playing:
        oled.text("RUN!", 48, 28)
    elif blink % 10 < 5:
        oled.text("PRESS START", 20, 28)
    else:
        oled.fill_rect(8, 40, 8, 16, 1)
    oled.line(0, 56, 127, 56, 1)  # 땅
    oled.show()
    blink = blink + 1
    time.sleep_ms(100)  # 한 프레임 = 0.1초
