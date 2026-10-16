from machine import Pin, PWM, SoftI2C
import ssd1306
import time
import dht

dht11 = dht.DHT11(Pin(13))
button = Pin(27, Pin.IN, Pin.PULL_UP)
tilt = Pin(14, Pin.IN)
pir = Pin(23, Pin.IN)
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
beeper = PWM(Pin(15))
beeper.freq(440)
beeper.duty(0)


def draw_face(state):
    oled.rect(72, 16, 48, 48, 1)
    oled.fill_rect(84, 28, 6, 6, 1)
    oled.fill_rect(102, 28, 6, 6, 1)
    if state == "SMILE":
        oled.line(84, 48, 96, 54, 1)
        oled.line(96, 54, 108, 48, 1)
    elif state == "BAD":
        oled.line(84, 54, 96, 48, 1)
        oled.line(96, 48, 108, 54, 1)
    else:
        oled.line(84, 52, 108, 52, 1)


started = False
state = "BLANK"
prev = "BLANK"
oled.fill(0)
oled.text("You Like Chick?", 4, 20)
oled.text("PRESS START", 20, 40)
oled.show()
while True:
    if button.value() == 0:
        started = True
    if started:
        dht11.measure()
        t = dht11.temperature()
        h = dht11.humidity()
        ok = 20 <= t <= 28 and 40 <= h <= 70
        if ok and (tilt.value() == 1 or pir.value() == 1):
            state = "SMILE"
        elif ok:
            state = "BLANK"
        else:
            state = "BAD"
        oled.fill(0)
        oled.text("S: " + state, 0, 0)
        oled.text("T: " + str(t) + "C", 0, 16)
        oled.text("H: " + str(h) + "%", 0, 32)
        draw_face(state)
        oled.show()
        if state != prev:
            if state == "SMILE":
                beeper.freq(523)
                beeper.duty(512)
                time.sleep(0.2)
                beeper.duty(0)
            elif state == "BAD":
                beeper.freq(262)
                beeper.duty(512)
                time.sleep(0.4)
                beeper.duty(0)
            else:
                beeper.freq(392)
                beeper.duty(512)
                time.sleep(0.2)
                beeper.duty(0)
            prev = state
        time.sleep(2)
    time.sleep(0.1)
