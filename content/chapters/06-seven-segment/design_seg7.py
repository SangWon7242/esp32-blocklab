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
    hc595_shift(SEGCODE[n] | (0x80 if dot else 0))


show_digit(3, False)
time.sleep(1)
show_digit(2, False)
time.sleep(1)
show_digit(1, False)
time.sleep(1)
show_digit(0, True)
time.sleep(2)
hc595_shift(0)
