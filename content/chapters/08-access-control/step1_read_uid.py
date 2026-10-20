from mfrc522_i2c import mfrc522
from blocklab_rfid import *

rc522 = mfrc522(22, 21, 0x28)  # RFID 깨우기 (SCL 핀, SDA 핀, 이름표)
rc522.PCD_Init()

while True:  # 계속 반복
    if card_present(rc522):  # 카드가 왔고 번호까지 읽었니?
        print("Card UID:")
        print(card_uid(rc522))  # 번호 보여 주기
