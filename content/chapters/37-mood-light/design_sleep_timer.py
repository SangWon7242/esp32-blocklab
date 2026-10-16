from machine import Pin, PWM, ADC
import time
import network
import socket

red = PWM(Pin(27))
green = PWM(Pin(25))
blue = PWM(Pin(26))
red.freq(1000)
green.freq(1000)
blue.freq(1000)
knob = ADC(Pin(39))
knob.atten(ADC.ATTN_11DB)
knob.width(ADC.WIDTH_12BIT)


def set_color(r, g, b):
    red.duty(r * 1023 // 255)
    green.duty(g * 1023 // 255)
    blue.duty(b * 1023 // 255)


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


def knob_color():
    value = knob.read()
    if value < 800:
        set_color(255, 0, 0)
    elif value < 1600:
        set_color(0, 255, 0)
    elif value < 2400:
        set_color(0, 0, 255)
    elif value < 3200:
        set_color(255, 0, 255)
    else:
        set_color(255, 255, 255)


def web_color(name):
    if name == "red":
        set_color(255, 0, 0)
    elif name == "green":
        set_color(0, 255, 0)
    elif name == "blue":
        set_color(0, 0, 255)


ip = wifi_connect("MyWiFi", "12345678")
server = web_start(80)

mode = 0
color = "off"
start = time.ticks_ms()
print(ip)
while True:
    conn, path, query = web_accept(server)
    c = query.get("c", "")
    if c == "off":
        mode = 0
        color = "off"
    elif c == "knob":
        mode = 1
        color = "knob"
        start = time.ticks_ms()
    elif c != "":
        mode = 2
        color = c
        start = time.ticks_ms()
    if time.ticks_diff(time.ticks_ms(), start) > 600000:
        mode = 0
        color = "off"
    if mode == 0:
        set_color(0, 0, 0)
    elif mode == 1:
        knob_color()
    else:
        web_color(color)
    if path == "/data":
        web_send(conn, "{\"mode\": " + str(mode) + ", \"c\": " + str("\"" + color + "\"") + "}", "application/json")
    elif path == "/cmd":
        web_send(conn, "OK")
    else:
        web_send_file(conn, "index.html")
