from machine import Pin, PWM, SoftI2C
import ssd1306
import time
import dht

dht11 = dht.DHT11(Pin(4))
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
motor1a = PWM(Pin(13))
motor1b = PWM(Pin(12))
motor1a.freq(1000)
motor1b.freq(1000)


def forward(speed):
    motor1a.duty(speed)
    motor1b.duty(0)


def backward(speed):
    motor1a.duty(0)
    motor1b.duty(speed)


def stop():
    motor1a.duty(0)
    motor1b.duty(0)


while True:
    dht11.measure()
    t = dht11.temperature()
    h = dht11.humidity()
    di = 0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3
    oled.fill(0)
    oled.text("DI: " + str(int(di)), 0, 24)
    oled.show()
    if di >= 75:
        forward(1023)
    else:
        stop()
    time.sleep(2)
