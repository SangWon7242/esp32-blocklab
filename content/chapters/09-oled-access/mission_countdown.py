from machine import Pin, PWM, SoftI2C
from mfrc522_i2c import mfrc522
import ssd1306
import time

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)

rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()

allowed = [[180, 180, 170, 219]]          # ★ 내 카드 번호로


def show(a, b):
    oled.fill(0)
    oled.text(a, 0, 20)
    oled.text(b, 0, 36)
    oled.show()


show("Tag your", "card...")

while True:
    if rc522.PICC_IsNewCardPresent():
        if rc522.PICC_ReadCardSerial() == True:
            uid = rc522.uid.uidByte[0 : rc522.uid.size]
            if uid in allowed:
                servo.duty_u16(8100)      # 문 열기
                for t in range(3, 0, -1):         # 3 → 2 → 1
                    show("OPEN", "Close: " + str(t))   # 숫자를 글자로
                    time.sleep(1)
                servo.duty_u16(1638)      # 문 닫기
            else:
                show("DENIED", "Unknown card")
                time.sleep(3)
            show("Tag your", "card...")
