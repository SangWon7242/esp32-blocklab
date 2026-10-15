import time
from irrecvdata import irGetCMD

ir = irGetCMD(5)  # IR 수신기 S 다리를 5번 핀에

while True:
    value = ir.ir_read()  # 받은 값 (없으면 None)
    if value:
        print(value)
    time.sleep(0.1)
