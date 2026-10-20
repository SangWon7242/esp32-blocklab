from machine import Pin
import time
from blocklab_net import *

led = Pin(2, Pin.OUT)  # 2번 핀의 LED

ip = wifi_connect("MyWiFi", "12345678")
server = web_start(80)

led.value(0)
print("http://" + ip)
while True:
    conn, path, query = web_accept(server)
    if query.get("led", "") == "on":
        led.value(1)
    if query.get("led", "") == "off":
        led.value(0)
    if query.get("led", "") == "blink":
        for i in range(3):
            led.value(1)
            time.sleep(0.3)
            led.value(0)
            time.sleep(0.3)
    web_send(conn, web_page("LED", "led=on,led=off,led=blink", query.get("led", ""), 0))
