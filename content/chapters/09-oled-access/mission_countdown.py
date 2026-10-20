from machine import Pin, PWM, SoftI2C
import ssd1306
import time
from mfrc522_i2c import mfrc522
from blocklab_rfid import *

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()


def show(a, b):
    oled.fill(0)
    oled.text(a, 0, 20)
    oled.text(b, 0, 36)
    oled.show()


allowed = [[180, 180, 170, 219]]  # ★ 내 카드 번호로
show("Tag your", "card...")
while True:
    if card_present(rc522):
        uid = card_uid(rc522)
        if uid in allowed:
            servo.duty_u16(8100)  # 문 열기
            for t in range(3, 0, -1):  # 3 → 2 → 1
                show("OPEN", "Close: " + str(t))  # 숫자를 글자로
                time.sleep(1)
            servo.duty_u16(1638)  # 문 닫기
        else:
            show("DENIED", "Unknown card")
            time.sleep(3)
        show("Tag your", "card...")
