from machine import Pin, PWM, ADC
import time
from blocklab_net import *

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
