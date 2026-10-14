from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522

servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


allowed = [[180, 180, 170, 219]]
while True:
    if card_present():
        if card_uid() in allowed:
            servo.duty_u16(8100)
            time.sleep(3)
            servo.duty_u16(1638)
    time.sleep(0.1)
