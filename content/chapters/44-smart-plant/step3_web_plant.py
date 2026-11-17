from machine import Pin, SoftI2C, ADC
import ssd1306
import time
from blocklab_net import *

soil = ADC(Pin(34))
soil.atten(ADC.ATTN_11DB)
soil.width(ADC.WIDTH_12BIT)
water = ADC(Pin(35))
water.atten(ADC.ATTN_11DB)
water.width(ADC.WIDTH_12BIT)
relay = Pin(26, Pin.OUT)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

ip = wifi_connect("MyWiFi", "12345678")  # 교실 WiFi 이름과 비밀번호로 바꿔요
server = web_start(80)

state = "OK"
while True:
    conn, path, query = web_accept(server)  # 폰이 요청할 때까지 기다려요
    s = soil.read()
    w = water.read()
    if w < 500:
        state = "NO WATER"
    elif s < 1500 or query.get("pump", "") == "on":
        state = "WATERING"  # 흙이 말랐거나 폰에서 물 주기 버튼을 눌렀을 때
        relay.value(1)  # 펌프를 1초만 켰다가 꺼요
        time.sleep(1)
        relay.value(0)
    else:
        state = "OK"
    oled.fill(0)
    oled.text("SOIL: " + str(s), 0, 0)
    oled.text("WATER: " + str(w), 0, 16)
    oled.text(state, 0, 32)
    oled.show()
    web_send(conn, web_page("Smart Plant", "pump=on", state + ",SOIL: " + str(s) + ",WATER: " + str(w), 2))
