import machine
import time

SEGCODE = [0x3f, 0x06, 0x5b, 0x4f,        # 0 1 2 3
           0x66, 0x6d, 0x7d, 0x07,        # 4 5 6 7
           0x7f, 0x6f]                    # 8 9

si = machine.Pin(5, machine.Pin.OUT)      # SI  — 켤지 말지를 올려 두는 핀
rck = machine.Pin(23, machine.Pin.OUT)    # RCK — 한꺼번에 내보내는 핀
sck = machine.Pin(18, machine.Pin.OUT)    # SCK — 한 칸씩 미는 핀


def hc595_shift(dat):                     # 숫자 하나를 도우미 칩에 보내기
    rck.off()
    for bit in range(7, -1, -1):          # 맨 왼쪽 자리부터 하나씩
        value = 1 & (dat >> bit)          # 그 자리가 0인지 1인지
        sck.off()
        si.value(value)                   # 값 올려 두기
        sck.on()                          # 한 칸 밀어 넣기
    rck.on()                              # 8칸을 한꺼번에 내보내기


while True:
    for num in range(10):                 # 0 → 9
        hc595_shift(SEGCODE[num])         # 그 숫자의 코드를 보내기
        time.sleep_ms(500)                # 0.5초마다 바뀜
