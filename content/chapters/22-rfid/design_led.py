from machine import Pin
import time
from mfrc522_i2c import mfrc522

led = Pin(2, Pin.OUT)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


allowed = [[180, 180, 170, 219], [231, 185, 101, 101]]
while True:
    if card_present():
        if card_uid() in allowed:
            led.value(1)
            time.sleep(1)
            led.value(0)
    time.sleep(0.1)
