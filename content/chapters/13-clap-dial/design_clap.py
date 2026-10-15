from machine import Pin, ADC
import time

sound = ADC(Pin(36))
sound.atten(ADC.ATTN_11DB)
sound.width(ADC.WIDTH_12BIT)
led = Pin(26, Pin.OUT)

count = 0
while True:
    if sound.read() > 2000:
        count = count + 1
        print("clap", count)
        if count % 2 == 1:
            led.value(1)
        else:
            led.value(0)
        time.sleep(0.3)
    time.sleep_ms(10)
