from machine import Pin, ADC
import time

sound = ADC(Pin(36))  # 소리 센서 S → 36번
sound.atten(ADC.ATTN_11DB)
sound.width(ADC.WIDTH_12BIT)
led = Pin(26, Pin.OUT)

count = 0
while True:
    if sound.read() > 2000:  # 기준보다 크면 박수
        count = count + 1
        print("clap", count)
        if count % 2 == 1:
            led.value(1)  # 홀수 번째 박수: 켜기
        else:
            led.value(0)  # 짝수 번째 박수: 끄기
        time.sleep(0.3)  # 같은 박수를 또 세지 않게 기다리기
    time.sleep_ms(10)
