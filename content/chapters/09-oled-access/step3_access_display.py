from machine import Pin, PWM, SoftI2C
import ssd1306
import time
from mfrc522_i2c import mfrc522

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


def show(a, b):
    oled.fill(0)
    oled.text(a, 0, 20)
    oled.text(b, 0, 36)
    oled.show()


allowed = [[180, 180, 170, 219]]  # ★ 내 카드 번호로
show("Tag your", "card...")  # 첫 화면
while True:
    if card_present():  # 카드가 왔고 번호를 읽었으면
        uid = card_uid()
        if uid in allowed:
            show("ACCESS OK", "Door open")  # 통과
            servo.duty_u16(8100)
        else:
            show("DENIED", "Unknown card")  # 거부
            servo.duty_u16(1638)
        time.sleep(3)
        show("Tag your", "card...")  # 다시 대기 화면
