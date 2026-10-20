from machine import Pin
import time

si = Pin(5, Pin.OUT)
rck = Pin(23, Pin.OUT)
sck = Pin(18, Pin.OUT)
SEGCODE = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f]


def hc595_shift(dat):
    rck.value(0)
    for bit in range(7, -1, -1):
        value = 1 & (dat >> bit)
        sck.value(0)
        si.value(value)
        sck.value(1)
    rck.value(1)


def show_digit(n, dot):
    code = SEGCODE[n]
    if dot:
        code = code | 128
    hc595_shift(code)


mynum = [3, 1, 4]  # 보여 줄 숫자를 목록에 담기
while True:
    for num in mynum:  # 목록에서 하나씩 꺼내기
        show_digit(num, False)
        time.sleep_ms(500)
