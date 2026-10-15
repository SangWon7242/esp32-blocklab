import time
from mfrc522_i2c import mfrc522

rc522 = mfrc522(22, 21, 0x28)  # RFID 리더 준비 (SCL 핀, SDA 핀, 주소)
rc522.PCD_Init()


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


while True:
    if card_present():  # 카드가 왔고 번호까지 읽었나요?
        print(card_uid())  # 카드 번호(숫자 4개) 출력
    time.sleep(0.5)
