# 블록랩 통신 도우미 (blocklab_net)
# WiFi 에 연결하거나(wifi_connect) 보드가 직접 WiFi 를 만들고(wifi_ap),
# 브라우저 요청을 받아 답하는 아주 작은 웹서버(web_start·web_accept·web_send …)를 만드는 함수 모음입니다.
# 블록랩이 만든 코드는 `from blocklab_net import *` 한 줄로 이 함수들을 가져다 씁니다.
# 보드에 저장하거나 실행할 때 블록랩이 이 파일을 보드에 함께 올립니다.

import network
import socket
import time


def wifi_connect(ssid, password):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)
    while not wlan.isconnected():
        time.sleep(0.5)
    print("IP:", wlan.ifconfig()[0])
    return wlan.ifconfig()[0]


def wifi_ap(name, password):
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    ap.config(essid=name, password=password)
    while not ap.active():
        time.sleep(0.5)
    print("IP:", ap.ifconfig()[0])
    return ap.ifconfig()[0]


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
