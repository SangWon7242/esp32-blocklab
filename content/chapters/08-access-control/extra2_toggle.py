from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522

servoPin = PWM(Pin(4))
servoPin.freq(50)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


allowed = [[180, 180, 170, 219]]  # ★ 내 번호로
is_open = False  # 지금 열려 있는지 기억하는 이름
servoPin.duty_u16(1638)
time.sleep(1)
while True:
    if card_present():
        uid = card_uid()
        if uid in allowed:
            if is_open:  # 열려 있었으면
                servoPin.duty_u16(1638)  # 닫기
                is_open = False
            else:
                servoPin.duty_u16(8100)  # 닫혀 있었으면 열기
                is_open = True
            time.sleep(1)
