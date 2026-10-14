from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522

servoPin = PWM(Pin(4))
servoPin.freq(50)

rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()

allowed = [[180, 180, 170, 219]]          # 들여보낼 카드 목록 (★ 내 번호로)
# 카드가 늘면 이렇게 줄만 더 적으면 됩니다:
# allowed = [[180, 180, 170, 219],
#            [231, 185, 101, 101]]

servoPin.duty_u16(1638)                   # 문 닫아 두기
time.sleep(1)

while True:
    if rc522.PICC_IsNewCardPresent():
        if rc522.PICC_ReadCardSerial() == True:
            uid = rc522.uid.uidByte[0 : rc522.uid.size]
            print("Card UID:", uid)
            if uid in allowed:            # 목록에 있니?
                servoPin.duty_u16(8100)   # 열기
                time.sleep(1)
            else:                         # 없으면
                servoPin.duty_u16(1638)   # 닫기
                time.sleep(1)
