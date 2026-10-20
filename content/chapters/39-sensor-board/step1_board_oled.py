from machine import Pin, SoftI2C, ADC
import ssd1306
import time
import dht

light = ADC(Pin(34))  # 조도: 포토레지스터와 10kΩ 사이 줄 → 34번. 뒤에 WiFi 를 쓸 거라 아날로그는 32~39번
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)
sound = ADC(Pin(35))  # 소리 센서 S → 35번
sound.atten(ADC.ATTN_11DB)
sound.width(ADC.WIDTH_12BIT)
knob = ADC(Pin(39))  # 가변저항 가운데 다리 → 39번
knob.atten(ADC.ATTN_11DB)
knob.width(ADC.WIDTH_12BIT)
dht11 = dht.DHT11(Pin(13))  # 온습도 센서 S → 13번
tilt = Pin(14, Pin.IN)  # 틸트 스위치와 10kΩ 사이 줄 → 14번 (기울면 1)
pir = Pin(23, Pin.IN)  # 인체감지 센서 S → 23번 (사람이 움직이면 1)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


def show_page(n, t, h):
    oled.fill(0)
    if n == 1:
        oled.text("L: " + str(light.read()), 0, 0)  # 페이지 1: 빛 · 소리 · 손잡이
        oled.text("S: " + str(sound.read()), 0, 16)
        oled.text("K: " + str(knob.read()), 0, 32)
    else:
        oled.text("T: " + str(t) + "C", 0, 0)  # 페이지 2: 온도 · 습도 · 틸트 · PIR
        oled.text("H: " + str(h) + "%", 0, 16)
        oled.text("TILT: " + str(tilt.value()), 0, 32)
        oled.text("PIR: " + str(pir.value()), 0, 48)
    oled.show()


dht11.measure()  # 처음 한 번 재 두기
t = dht11.temperature()
h = dht11.humidity()
last = time.ticks_ms()  # 마지막으로 잰 시각
start = time.ticks_ms()  # 페이지를 바꾼 시각
page = 1
while True:
    if time.ticks_diff(time.ticks_ms(), last) >= 2000:  # 2초 지났으면 새로 재고 찍기
        last = time.ticks_ms()
        dht11.measure()
        t = dht11.temperature()
        h = dht11.humidity()
        print("L: " + str(light.read()) + " S: " + str(sound.read()) + " K: " + str(knob.read()))
        print("T: " + str(t) + " H: " + str(h) + " TILT: " + str(tilt.value()) + " PIR: " + str(pir.value()))
    if time.ticks_diff(time.ticks_ms(), start) >= 3000:  # 3초 지났으면 페이지 바꾸기
        start = time.ticks_ms()
        if page == 1:
            page = 2
        else:
            page = 1
        show_page(page, t, h)
    time.sleep(0.1)  # 길게 멈추지 않고 잠깐만 쉬어요
