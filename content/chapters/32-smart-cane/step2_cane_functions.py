from machine import Pin, PWM, ADC
import time

trig = Pin(13, Pin.OUT)
echo = Pin(12, Pin.IN)
beeper = PWM(Pin(15))
beeper.freq(440)
beeper.duty(0)
led = Pin(26, Pin.OUT)  # 26번 = 밤에 남에게 보이는 LED
light = ADC(Pin(36))  # 36번 = 조도 센서 (어두울수록 값이 커요)
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)
tilt = Pin(14, Pin.IN)  # 14번 = 틸트 스위치 (누우면 1)


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


def check_distance():
    d = get_distance()
    print(d, "cm")
    if d < 30:
        beeper.freq(880)
        beeper.duty(512)
        time.sleep(0.1)
        beeper.duty(0)
        time.sleep(0.3)


def check_light():
    if light.read() > 2500:  # 기준값 2500 은 예시, 내가 잰 값으로
        led.value(1)
    else:
        led.value(0)


def check_tilt():
    if tilt.value() == 1:
        print("지팡이가 누웠어요")


time.sleep(2)
while True:
    check_distance()  # 하나, 앞에 무엇이 있나
    check_light()  # 둘, 어두운가
    check_tilt()  # 셋, 지팡이가 누웠나
    time.sleep(0.1)
