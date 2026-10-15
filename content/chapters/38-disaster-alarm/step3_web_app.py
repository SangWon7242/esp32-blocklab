from machine import Pin, PWM, ADC
import time
import dht
import network
import socket

flame = ADC(Pin(34))
flame.atten(ADC.ATTN_11DB)
flame.width(ADC.WIDTH_12BIT)
dht11 = dht.DHT11(Pin(13))
tilt = Pin(14, Pin.IN)
button = Pin(27, Pin.IN, Pin.PULL_UP)
beeper = PWM(Pin(15))
beeper.freq(440)
beeper.duty(0)


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


def web_send_file(conn, name):
    try:
        f = open(name)
        web_send(conn, f.read())
        f.close()
    except OSError:
        web_send(conn, "<h1>" + name + " not found</h1>")


ip = wifi_connect("MyWiFi", "12345678")
server = web_start(80)

while True:
    conn, path, query = web_accept(server)
    dht11.measure()
    t = dht11.temperature()
    f = flame.read()
    if f >= 1500 and t >= 27:
        state = "FIRE"
    elif tilt.value() == 1:
        state = "QUAKE"
    elif button.value() == 0:
        state = "HERE"
    else:
        state = "OK"
    print(state)
    print(f, t)
    if state == "FIRE" or state == "QUAKE":
        beeper.freq(880)
        beeper.duty(512)
        time.sleep(0.5)
        beeper.duty(0)
    if path == "/data":  # 앱이 2초마다 읽어 가는 값
        web_send(conn, "{\"state\": " + str("\"" + state + "\"") + ", \"temp\": " + str(t) + "}", "application/json")
    elif path == "/cmd":
        if query.get("exit", "") == "1":
            beeper.freq(660)
            beeper.duty(512)
            time.sleep(1)
            beeper.duty(0)
        web_send(conn, "OK")
    else:
        web_send_file(conn, "index.html")  # 보드에 올린 앱 화면
