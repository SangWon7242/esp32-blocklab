from machine import Pin
import time
from mfrc522_i2c import mfrc522
from blocklab_rfid import *

led = Pin(2, Pin.OUT)
rc522 = mfrc522(22, 21, 0x28)
rc522.PCD_Init()

allowed = [[180, 180, 170, 219], [231, 185, 101, 101]]
while True:
    if card_present(rc522):
        if card_uid(rc522) in allowed:
            led.value(1)
            time.sleep(1)
            led.value(0)
    time.sleep(0.1)
