from machine import Pin, PWM, SoftI2C     # 화면을 쓰려고 SoftI2C 추가
import ssd1306                            # OLED 설명서 펼치기
import time

trig = Pin(13, Pin.OUT)                   # 초음파를 쏘는 핀
echo = Pin(12, Pin.IN)                    # 메아리를 듣는 핀

servo = PWM(Pin(4))                       # 문이 될 서보
servo.freq(50)                            # 서보는 50Hz
servo.duty_u16(1638)                      # 처음엔 문 닫기

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))   # 화면이 쓸 두 선 정하기
oled = ssd1306.SSD1306_I2C(128, 64, i2c)  # 128x64 화면 준비


def get_distance():                       # 거리를 재는 함수
    trig.value(1)                         # 초음파 쏘기
    time.sleep_us(10)                     # 10마이크로초만
    trig.value(0)                         # 그만 쏘기
    while not echo.value():               # 신호 시작까지 기다리기
        pass
    start = time.ticks_us()               # 시작 시간
    while echo.value():                   # 메아리 올 때까지
        pass
    stop = time.ticks_us()                # 돌아온 시간
    t = time.ticks_diff(stop, start) // 2  # 가는 시간만
    return int(340 * t // 10000)          # cm 로 바꿔 알려 주기


def show(a, b):                           # 두 줄을 화면에 띄우는 함수
    oled.fill(0)                          # 화면 지우기
    oled.text(a, 0, 20)                   # 첫 줄 적어 두기
    oled.text(b, 0, 36)                   # 둘째 줄 적어 두기
    oled.show()                           # 화면에 나타내기


time.sleep(2)                             # 센서 준비 2초
show("AUTO DOOR", "Come closer")          # 대기 화면

while True:
    d = get_distance()                    # 거리 재기
    if d < 15:                            # 15cm 안으로 들어오면
        show("DOOR OPEN", str(d) + " cm")  # 열렸다고 화면에 알리고
        servo.duty_u16(8100)              # 문 열기
        time.sleep(3)                     # 3초 열어 두기
        show("DOOR CLOSE", "Bye~")        # 닫힌다고 화면에 알리고
        servo.duty_u16(1638)              # 문 닫기
        time.sleep(1)                     # 1초 쉬고
        show("AUTO DOOR", "Come closer")  # 다시 대기 화면
    time.sleep_ms(300)                    # 0.3초마다 다시 재기
