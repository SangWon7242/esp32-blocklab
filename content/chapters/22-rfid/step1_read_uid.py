import time
from mfrc522_i2c import mfrc522
from blocklab_rfid import *

rc522 = mfrc522(22, 21, 0x28)  # RFID 리더 준비 (SCL 핀, SDA 핀, 주소)
rc522.PCD_Init()

while True:
    if card_present(rc522):  # 카드가 왔고 번호까지 읽었나요?
        print(card_uid(rc522))  # 카드 번호(숫자 4개) 출력
    time.sleep(0.5)
