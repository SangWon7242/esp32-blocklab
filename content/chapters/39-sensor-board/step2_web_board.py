from machine import Pin, SoftI2C, ADC
import ssd1306
import time
import dht
import network
import socket

light = ADC(Pin(34))
light.atten(ADC.ATTN_11DB)
light.width(ADC.WIDTH_12BIT)
sound = ADC(Pin(35))
sound.atten(ADC.ATTN_11DB)
sound.width(ADC.WIDTH_12BIT)
knob = ADC(Pin(39))
knob.atten(ADC.ATTN_11DB)
knob.width(ADC.WIDTH_12BIT)
dht11 = dht.DHT11(Pin(13))
tilt = Pin(14, Pin.IN)
pir = Pin(23, Pin.IN)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)


def wifi_connect(ssid, password):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    while not wlan.isconnected():
        time.sleep(0.5)
    print("IP:", wlan.ifconfig()[0])
    return wlan.ifconfig()[0]


def web_start(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("", port))
    s.listen(5)
    return s


def web_accept(s):
    conn, addr = s.accept()
    request = conn.recv(1024).decode()
    line = request.split("\r\n")[0]
    target = line.split(" ")[1] if " " in line else "/"
    path, _, qs = target.partition("?")
    query = {}
    for part in qs.split("&"):
        if "=" in part:
            k, v = part.split("=", 1)
            query[k] = v
    return conn, path, query


def web_send(conn, body, ctype="text/html"):
    conn.send("HTTP/1.1 200 OK\r\n")
    conn.send("Content-Type: " + ctype + "\r\n")
    conn.send("Connection: close\r\n\r\n")
    conn.sendall(body)
    conn.close()


def web_page(title, buttons, values, refresh):
    html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'>"
    if refresh > 0:
        html += "<meta http-equiv='refresh' content='" + str(refresh) + "'>"
    html += "<title>" + title + "</title></head><body><h1>" + title + "</h1>"
    for b in buttons.split(","):
        if b:
            html += "<p><a href='/cmd?" + b + "'><button>" + b + "</button></a></p>"
    for v in values.split(","):
        if v:
            html += "<p>" + v + "</p>"
    return html + "</body></html>"


def show_page(n, t, h):
    oled.fill(0)
    if n == 1:
        oled.text("L: " + str(light.read()), 0, 0)
        oled.text("S: " + str(sound.read()), 0, 16)
        oled.text("K: " + str(knob.read()), 0, 32)
    else:
        oled.text("T: " + str(t) + "C", 0, 0)
        oled.text("H: " + str(h) + "%", 0, 16)
        oled.text("TILT: " + str(tilt.value()), 0, 32)
        oled.text("PIR: " + str(pir.value()), 0, 48)
    oled.show()


ip = wifi_connect("MyWiFi", "12345678")  # 교실 WiFi 이름과 비밀번호로 바꿔요
server = web_start(80)

dht11.measure()
t = dht11.temperature()
h = dht11.humidity()
last = time.ticks_ms()
page = 1
while True:
    conn, path, query = web_accept(server)  # 폰이 요청할 때까지 기다려요
    if time.ticks_diff(time.ticks_ms(), last) >= 2000:  # 2초 지났으면 온습도만 새로 재요
        last = time.ticks_ms()
        dht11.measure()
        t = dht11.temperature()
        h = dht11.humidity()
    if query.get("page", "") == "1":  # /cmd?page=1 → OLED 페이지 1
        page = 1
    if query.get("page", "") == "2":
        page = 2
    show_page(page, t, h)
    if path == "/data":  # 앱이 읽는 JSON
        web_send(conn, "{\"temp\": " + str(t) + ", \"hum\": " + str(h) + "}", "application/json")
    elif path == "/light":
        web_send(conn, "{\"light\": " + str(light.read()) + "}", "application/json")
    else:
        web_send(conn, web_page("Sensor Board", "page=1,page=2", "L: " + str(light.read()) + ",S: " + str(sound.read()) + ",T: " + str(t) + "C,H: " + str(h) + "%", 2))
