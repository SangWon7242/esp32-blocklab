import machine                            # 기본 기능 가져오기
import time                               # 시간 기능 가져오기
from mfrc522_i2c import mfrc522           # RFID 설명서 펼치기

addr = 0x28                               # RFID 이름표
scl = 22                                  # 신호선 핀 번호
sda = 21                                  # 데이터선 핀 번호

rc522 = mfrc522(scl, sda, addr)           # RFID 깨우기
rc522.PCD_Init()                          # 시작 준비
rc522.ShowReaderDetails()                 # 버전 확인 (여기서 한 줄 찍혀야 정상)

while True:                               # 계속 반복
    if rc522.PICC_IsNewCardPresent():     # 카드 왔니?
        if rc522.PICC_ReadCardSerial() == True:
            print("Card UID:")
            print(rc522.uid.uidByte[0 : rc522.uid.size])   # 번호 보여주기
