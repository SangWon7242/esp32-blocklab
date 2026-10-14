from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522

servoPin = PWM(Pin(4))
servoPin.freq(50)

led = Pin(26, Pin.OUT)                    # LED 준비 (IO26)

rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()

allowed = [[180, 180, 170, 219]]          # ★ 내 번호로

servoPin.duty_u16(1638)                   # 문 닫아 두기
led.value(0)                              # 불도 꺼 두기
time.sleep(1)

while True:
    if rc522.PICC_IsNewCardPresent():
        if rc522.PICC_ReadCardSerial() == True:
            uid = rc522.uid.uidByte[0 : rc522.uid.size]
            print("Card UID:", uid)
            if uid in allowed:            # 등록된 카드면
                servoPin.duty_u16(8100)   # 문 열기
                led.value(1)              # 불 켜기
                time.sleep(1)
            else:                         # 아니면
                servoPin.duty_u16(1638)   # 문 닫기
                led.value(0)              # 불 끄기
                time.sleep(1)
