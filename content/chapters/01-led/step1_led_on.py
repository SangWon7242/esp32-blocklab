from machine import Pin

led = Pin(26, Pin.OUT)  # IO26을 출력으로, 이름은 led

led.value(1)  # HIGH 신호 → LED 켜짐
