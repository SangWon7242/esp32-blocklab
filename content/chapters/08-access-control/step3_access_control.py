from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522

servoPin = PWM(Pin(4))  # 서보 준비
servoPin.freq(50)
rc522 = mfrc522(22, 21, 0x28)  # RFID 준비 (SCL 핀, SDA 핀, 이름표)
rc522.PCD_Init()


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


uid1 = [180, 180, 170, 219]  # ★ 내 카드 번호로 바꾸세요
servoPin.duty_u16(1638)  # 문 닫아 두기
time.sleep(1)
while True:  # 계속 반복
    if card_present():  # 카드가 왔고 번호를 읽었니?
        uid = card_uid()
        print("Card UID:", uid)  # 번호 찍기
        if uid == uid1:  # 등록된 카드니?
            servoPin.duty_u16(8100)  # 문 열기
            time.sleep(1)
        else:
            servoPin.duty_u16(1638)  # 아니면 문 닫기
            time.sleep(1)
