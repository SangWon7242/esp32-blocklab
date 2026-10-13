# 추가 미션 2 · 사람이 멀어질 때까지 문 열어 두기
# 열리는 거리는 15cm, 닫히는 거리는 25cm 로 다르게 잡습니다.
# 둘 다 15로 하면 15cm 근처에서 열림·닫힘이 번갈아 바뀌어 문이 떨립니다.

from machine import Pin, PWM, SoftI2C
import ssd1306
import time

trig = Pin(13, Pin.OUT)
echo = Pin(12, Pin.IN)

servo = PWM(Pin(4))
servo.freq(50)
servo.duty_u16(1638)

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


def get_distance():
    trig.value(1)
    time.sleep_us(10)
    trig.value(0)
    while not echo.value():
        pass
    start = time.ticks_us()
    while echo.value():
        pass
    stop = time.ticks_us()
    t = time.ticks_diff(stop, start) // 2
    return int(340 * t // 10000)


def show(a, b):
    oled.fill(0)
    oled.text(a, 0, 20)
    oled.text(b, 0, 36)
    oled.show()


time.sleep(2)
show("AUTO DOOR", "Come closer")

while True:
    d = get_distance()
    if d < 15:                            # 15cm 안으로 오면
        show("DOOR OPEN", "Welcome")
        servo.duty_u16(8100)              # 문 열기
        while get_distance() < 25:        # ★ 25cm 밖으로 나갈 때까지
            time.sleep_ms(200)            #    0.2초마다 다시 확인
        show("DOOR CLOSE", "Bye~")
        servo.duty_u16(1638)              # 그제야 문 닫기
        time.sleep(1)
        show("AUTO DOOR", "Come closer")
    time.sleep_ms(300)
