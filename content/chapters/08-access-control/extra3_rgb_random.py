# 추가 미션 3 · 문이 열릴 때마다 랜덤 색으로 빛나기 (05장 RGB LED 활용)
# 배선: IO27 → 220Ω → R / IO25 → 220Ω → G / IO26 → 220Ω → B
#       RGB LED 가장 긴 다리 → GND
# ※ 조립 미션의 빨강 LED(IO26)는 빼세요. RGB 파랑과 핀이 겹칩니다.

from machine import Pin, PWM
import random                             # ★ 랜덤(아무거나 고르기) 기능
import time
from mfrc522_i2c import mfrc522

servoPin = PWM(Pin(4))                    # 문이 될 서보
servoPin.freq(50)                         # 서보는 1초에 50번

red = PWM(Pin(27))                        # ★ 05장과 똑같은 세 핀
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)                            # RGB는 1초에 1000번
green.freq(1000)
blue.freq(1000)

rc522 = mfrc522(22, 21, 0x28)             # RFID 준비
rc522.PCD_Init()                          # 시작 준비

allowed = [[180, 180, 170, 219]]          # ★ 내 카드 번호로 바꾸기

colors = [(255, 128, 0), (255, 255, 0),   # ★ 주황, 노랑
          (0, 255, 0), (0, 255, 255),     #    초록, 하늘
          (0, 0, 255), (255, 0, 255)]     #    파랑, 분홍
# 빨강은 '거부' 표시로만 쓰려고 목록에서 뺐습니다.


def interval_mapping(x, in_min, in_max, out_min, out_max):
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min


def color_to_duty(rgb_value):             # 0~255 를 0~1023 으로 (05장과 같음)
    return int(interval_mapping(rgb_value, 0, 255, 0, 1023))


def set_color(r, g, b):                   # 세 색을 한꺼번에 정하기
    red.duty(color_to_duty(r))
    green.duty(color_to_duty(g))
    blue.duty(color_to_duty(b))


servoPin.duty_u16(1638)                   # 문 닫아 두기
set_color(0, 0, 0)                        # 불도 꺼 두기
time.sleep(1)

while True:
    if rc522.PICC_IsNewCardPresent():     # 카드가 왔는지 보고
        if rc522.PICC_ReadCardSerial() == True:   # 번호를 읽었으면
            uid = rc522.uid.uidByte[0 : rc522.uid.size]
            print("Card UID:", uid)       # 읽은 번호 찍어 보기
            if uid in allowed:            # 등록된 카드면
                c = random.choice(colors)      # ★ 색 하나 아무거나 고르기!
                set_color(c[0], c[1], c[2])    # ★ 그 색으로 불 켜기
                servoPin.duty_u16(8100)        # 문 열기
                time.sleep(3)                  # 3초 열어 두기
                servoPin.duty_u16(1638)        # 문 닫기
            else:                         # 모르는 카드면
                set_color(255, 0, 0)      # ★ 빨강으로 거부 표시
                time.sleep(1)             # 1초 보여 주기
            set_color(0, 0, 0)            # ★ 끝나면 불 끄기
