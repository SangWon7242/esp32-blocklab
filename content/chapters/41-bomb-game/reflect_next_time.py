import time
import random

next_time = [0, 0, 0]
count = [0, 0, 0]
start = time.ticks_ms()
while time.ticks_diff(time.ticks_ms(), start) < 3000:
    for i in range(3):
        if time.ticks_diff(time.ticks_ms(), next_time[i]) >= 0:
            count[i] = count[i] + 1
            next_time[i] = time.ticks_ms() + random.randint(300, 800)
    time.sleep(0.01)
print(count)
