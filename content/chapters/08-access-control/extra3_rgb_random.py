# 추가 미션 3 · 문이 열릴 때마다 랜덤 색으로 빛나기 (05장 RGB LED 활용)
# 배선: IO27 → 220Ω → R / IO25 → 220Ω → G / IO26 → 220Ω → B
#       RGB LED 가장 긴 다리 → GND
# ※ 조립 미션의 빨강 LED(IO26)는 빼세요. RGB 파랑과 핀이 겹칩니다.

from machine import Pin, PWM
import time
import random
from mfrc522_i2c import mfrc522

servoPin = PWM(Pin(4))  # 문이 될 서보
servoPin.freq(50)
red = PWM(Pin(27))  # ★ 05장과 똑같은 세 핀
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)
rc522 = mfrc522(22, 21, 0x28)  # RFID 준비
rc522.PCD_Init()


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


def card_present():
    return rc522.PICC_IsNewCardPresent() and rc522.PICC_ReadCardSerial()


def card_uid():
    return rc522.uid.uidByte[0:rc522.uid.size]


allowed = [[180, 180, 170, 219]]  # ★ 내 카드 번호로 바꾸기
# 주황, 노랑, 초록, 하늘, 파랑, 분홍 (빨강은 '거부' 표시로만 쓰려고 뺐습니다)
colors = [[255, 128, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255]]
servoPin.duty_u16(1638)  # 문 닫아 두기
set_color(0, 0, 0)  # 불도 꺼 두기
time.sleep(1)
while True:
    if card_present():  # 카드가 왔고 번호를 읽었으면
        uid = card_uid()
        print("Card UID:", uid)  # 읽은 번호 찍어 보기
        if uid in allowed:  # 등록된 카드면
            c = colors[random.randint(0, 5)]  # ★ 색 하나 아무거나 고르기!
            set_color(c[0], c[1], c[2])  # ★ 그 색으로 불 켜기
            servoPin.duty_u16(8100)  # 문 열기
            time.sleep(3)  # 3초 열어 두기
            servoPin.duty_u16(1638)  # 문 닫기
        else:
            set_color(255, 0, 0)  # ★ 모르는 카드면 빨강으로 거부 표시
            time.sleep(1)  # 1초 보여 주기
        set_color(0, 0, 0)  # ★ 끝나면 불 끄기
