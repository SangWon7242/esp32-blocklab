from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522           # RFID 설명서

servoPin = PWM(Pin(4))                    # 서보 준비
servoPin.freq(50)                         # 1초에 50번

addr = 0x28                               # 이름표
scl = 22                                  # 신호선
sda = 21                                  # 데이터선

rc522 = mfrc522(scl, sda, addr)           # RFID 준비
rc522.PCD_Init()
rc522.ShowReaderDetails()

uid1 = [180, 180, 170, 219]               # ★ 내 카드 번호로 바꾸세요

servoPin.duty_u16(1638)                   # 문 닫아 두기
time.sleep(1)

while True:                               # 계속 반복
    if rc522.PICC_IsNewCardPresent():     # 카드 왔니?
        if rc522.PICC_ReadCardSerial() == True:
            uid = rc522.uid.uidByte[0 : rc522.uid.size]
            print("Card UID:", uid)       # 번호 찍기
            if uid == uid1:               # 등록된 카드니?
                servoPin.duty_u16(8100)   # 문 열기
                time.sleep(1)
            else:                         # 아니면
                servoPin.duty_u16(1638)   # 문 닫기
                time.sleep(1)
