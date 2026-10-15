import time
from mfrc522_i2c import mfrc522

rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


allowed = [[180, 180, 170, 219], [231, 185, 101, 101]]  # 들여보낼 카드 번호 목록
while True:
    if card_present():
        uid = card_uid()
        print(uid)
        if uid in allowed:  # 목록 안에 있나요?
            print("OPEN")
        else:
            print("DENY")
    time.sleep(0.5)
