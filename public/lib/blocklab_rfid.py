# 블록랩 RFID 도우미 (blocklab_rfid)
# RFID 읽개(mfrc522_i2c 의 mfrc522)로 새 카드가 닿았는지 보고(card_present), 그 카드 번호를 꺼내는(card_uid) 함수입니다.
# 블록랩이 만든 코드는 `from blocklab_rfid import *` 한 줄로 가져와 card_present(rc522)·card_uid(rc522) 처럼 부릅니다.
# 보드에 저장하거나 실행할 때 블록랩이 이 파일을 보드에 함께 올립니다.


def card_present(reader):
    return reader.PICC_IsNewCardPresent() and reader.PICC_ReadCardSerial()


def card_uid(reader):
    return reader.uid.uidByte[0:reader.uid.size]
