from machine import Pin
import time

pir = Pin(23, Pin.IN)  # 인체감지(PIR) 센서: 사람이 움직이면 1
led = Pin(26, Pin.OUT)

print("예열 중... 30초 기다려요")
time.sleep(30)  # 센서가 자리를 잡을 때까지
print("감시 시작")
while True:
    if pir.value() == 1:  # 사람이 있으면
        print("사람이 왔어요")
        led.value(1)
        time.sleep(5)  # 5초 동안 켜 두기
        led.value(0)
    time.sleep(0.1)
