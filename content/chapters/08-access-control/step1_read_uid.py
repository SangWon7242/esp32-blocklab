from mfrc522_i2c import mfrc522

rc522 = mfrc522(22, 21, 0x28)  # RFID 깨우기 (SCL 핀, SDA 핀, 이름표)
rc522.PCD_Init()


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


while True:  # 계속 반복
    if card_present():  # 카드가 왔고 번호까지 읽었니?
        print("Card UID:")
        print(card_uid())  # 번호 보여 주기
