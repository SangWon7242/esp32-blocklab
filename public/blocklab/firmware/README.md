# MicroPython 펌웨어

`ESP32_GENERIC-20260824-v1.29.0.bin` — micropython.org 의 ESP32_GENERIC v1.29.0 그대로
(https://micropython.org/download/ESP32_GENERIC/, MIT License, Copyright (c) 2013-2026 Damien P. George and contributors).

「펌웨어 설치」 창(`src/app/firmware/`)이 이 파일을 받아 ESP32 의 0x1000 에 쓴다. 크기 · SHA-256 은
`src/device/firmware.ts` 의 `FIRMWARE` 에 적혀 있고 `firmware.test.ts` 가 맞는지 지킨다.
판을 바꿀 때는 파일과 `FIRMWARE` 를 함께 바꾼다.
