from machine import Pin, SoftI2C, ADC
import ssd1306
import time
import dht

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


def show_page(n, t, h):
    oled.fill(0)
    if n == 1:
        oled.text("L: " + str(light.read()), 0, 0)
        if light.read() > limit:  # 기준을 넘으면(어두우면) 느낌표
            oled.text("!", 112, 0)
        oled.text("S: " + str(sound.read()), 0, 16)
        if sound.read() > limit:  # 기준을 넘으면(시끄러우면) 느낌표
            oled.text("!", 112, 16)
        oled.text("K: " + str(knob.read()), 0, 32)
    else:
        oled.text("T: " + str(t) + "C", 0, 0)
        oled.text("H: " + str(h) + "%", 0, 16)
        oled.text("TILT: " + str(tilt.value()), 0, 32)
        oled.text("PIR: " + str(pir.value()), 0, 48)
    oled.show()


limit = 2000  # 기준값 (0~4095 가운데)
dht11.measure()
t = dht11.temperature()
h = dht11.humidity()
last = time.ticks_ms()
start = time.ticks_ms()
page = 1
while True:
    if time.ticks_diff(time.ticks_ms(), last) >= 2000:
        last = time.ticks_ms()
        dht11.measure()
        t = dht11.temperature()
        h = dht11.humidity()
        print("L: " + str(light.read()) + " S: " + str(sound.read()) + " K: " + str(knob.read()))
        print("T: " + str(t) + " H: " + str(h) + " TILT: " + str(tilt.value()) + " PIR: " + str(pir.value()))
    if time.ticks_diff(time.ticks_ms(), start) >= 3000:
        start = time.ticks_ms()
        if page == 1:
            page = 2
        else:
            page = 1
        show_page(page, t, h)
    time.sleep(0.1)
