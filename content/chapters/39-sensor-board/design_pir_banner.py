from machine import Pin
from blocklab_net import *

pir = Pin(23, Pin.IN)

ip = wifi_connect("MyWiFi", "12345678")
server = web_start(80)

last = 0
banner = ""
while True:
    conn, path, query = web_accept(server)
    now = pir.value()
    if now == 1 and last == 0:
        banner = "DETECTED"
    else:
        banner = ""
    last = now
    web_send(conn, web_page("Sensor Board", "", banner, 2))
