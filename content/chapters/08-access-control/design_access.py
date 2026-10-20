from machine import Pin, PWM
import time
from mfrc522_i2c import mfrc522
from blocklab_rfid import *

servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()

allowed = [[180, 180, 170, 219]]
while True:
    if card_present(rc522):
        if card_uid(rc522) in allowed:
            servo.duty_u16(8100)
            time.sleep(3)
            servo.duty_u16(1638)
    time.sleep(0.1)
