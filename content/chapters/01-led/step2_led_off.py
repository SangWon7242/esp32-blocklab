from machine import Pin        # 핀 기능 가져오기

led = Pin(26, Pin.OUT)         # IO26을 출력으로, 이름은 led

led.value(0)                   # LOW 신호 → LED 꺼짐
