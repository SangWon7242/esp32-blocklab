import time
from mfrc522_i2c import mfrc522
from blocklab_rfid import *

rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()

allowed = [[180, 180, 170, 219], [231, 185, 101, 101]]  # 들여보낼 카드 번호 목록
while True:
    if card_present(rc522):
        uid = card_uid(rc522)
        print(uid)
        if uid in allowed:  # 목록 안에 있나요?
            print("OPEN")
        else:
            print("DENY")
    time.sleep(0.5)
