from machine import Pin, PWM, SoftI2C
from mfrc522_i2c import mfrc522
import ssd1306
import time

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))   # RFID와 같은 선
oled = ssd1306.SSD1306_I2C(128, 64, i2c)  # 화면 준비

servo = PWM(Pin(4))                       # 서보 준비
servo.freq(50)
servo.duty_u16(1638)                      # 문 닫아 두기

rc522 = mfrc522(22, 21, 0x28)             # RFID 준비
rc522.PCD_Init()

allowed = [[180, 180, 170, 219]]          # ★ 내 카드 번호로


def show(a, b):                           # 두 줄 안내를 띄우는 함수
    oled.fill(0)                          # 지우고
    oled.text(a, 0, 20)                   # 첫 줄
    oled.text(b, 0, 36)                   # 둘째 줄
    oled.show()                           # 화면에 나타내기


show("Tag your", "card...")               # 첫 화면

while True:
    if rc522.PICC_IsNewCardPresent():
        if rc522.PICC_ReadCardSerial() == True:
            uid = rc522.uid.uidByte[0 : rc522.uid.size]
            if uid in allowed:
                show("ACCESS OK", "Door open")    # 통과
                servo.duty_u16(8100)
            else:
                show("DENIED", "Unknown card")    # 거부
                servo.duty_u16(1638)
            time.sleep(3)
            show("Tag your", "card...")   # 다시 대기 화면
