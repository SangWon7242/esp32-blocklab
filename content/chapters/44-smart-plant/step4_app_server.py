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

ip = wifi_connect("MyWiFi", "12345678")
server = web_start(80)

state = "OK"
while True:
    conn, path, query = web_accept(server)
    s = soil.read()
    w = water.read()
    if w < 500:
        state = "NO WATER"
    elif s < 1500 or query.get("pump", "") == "on":
        state = "WATERING"
        relay.value(1)
        time.sleep(1)
        relay.value(0)
    else:
        state = "OK"
    oled.fill(0)
    oled.text("SOIL: " + str(s), 0, 0)
    oled.text("WATER: " + str(w), 0, 16)
    oled.text(state, 0, 32)
    oled.show()
    if path == "/data":  # 앱이 읽는 JSON
        web_send(conn, "{\"soil\": " + str(s) + ", \"water\": " + str(w) + "}", "application/json")
    elif path == "/cmd":
        web_send(conn, "OK")  # 명령에는 짧게 OK 라고만 답해요
    else:
        web_send_file(conn, "index.html")  # 보드에 저장한 내 앱
