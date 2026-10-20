from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522
from blocklab_rfid import *

servoPin = PWM(Pin(4))
servoPin.freq(50)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()

allowed = [[180, 180, 170, 219]]  # 들여보낼 카드 목록 (★ 내 번호로)
# 카드가 늘면 목록 안에 카드 번호만 더 적으면 됩니다:
# allowed = [[180, 180, 170, 219], [231, 185, 101, 101]]
servoPin.duty_u16(1638)  # 문 닫아 두기
time.sleep(1)
while True:
    if card_present(rc522):
        uid = card_uid(rc522)
        print("Card UID:", uid)
        if uid in allowed:  # 목록에 있니?
            servoPin.duty_u16(8100)  # 열기
            time.sleep(1)
        else:
            servoPin.duty_u16(1638)  # 없으면 닫기
            time.sleep(1)
