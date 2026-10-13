# 미션 정답 · 대기 화면에도 지금 거리를 보여 주기
# step3_auto_door.py 의 준비 부분(윗부분)은 그대로 두고,
# 맨 아래 while 안쪽만 아래처럼 바꾸면 됩니다.

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
    d = get_distance()                    # 거리 재기
    show("AUTO DOOR", str(d) + " cm")     # ★ 여기가 추가된 한 줄!
    if d < 15:                            # 가까이 오면
        show("DOOR OPEN", "Welcome")      # 열렸다고 알리고
        servo.duty_u16(8100)              # 문 열기
        time.sleep(3)                     # 3초 열어 두기
        show("DOOR CLOSE", "Bye~")        # 닫힌다고 알리고
        servo.duty_u16(1638)              # 문 닫기
        time.sleep(1)                     # 1초 쉬고
    time.sleep_ms(300)                    # 0.3초마다 다시
# 맨 아래에서 매번 대기 화면을 다시 그리므로
# if 가 끝난 뒤 다시 그려 줄 필요가 없어졌습니다.
