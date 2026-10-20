from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522
from blocklab_rfid import *

servoPin = PWM(Pin(4))
servoPin.freq(50)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()

allowed = [[180, 180, 170, 219]]  # ★ 내 번호로
servoPin.duty_u16(1638)
time.sleep(1)
while True:
    if card_present(rc522):
        uid = card_uid(rc522)
        if uid in allowed:
            servoPin.duty_u16(8100)  # 문 열기
            time.sleep(3)  # 3초 기다렸다가
            servoPin.duty_u16(1638)  # 저절로 닫기
        else:
            servoPin.duty_u16(1638)
            time.sleep(1)
