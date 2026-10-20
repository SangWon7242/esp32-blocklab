/**
 * WiFi·웹·RFID 도우미를 보드 라이브러리(public/lib/blocklab_net.py·blocklab_rfid.py)로 옮기면서 아직 옛 꼴(파일 안의 def 도우미,
 * card_present() 인자 없음)으로 남은 수업 파일. 다음 단계(챕터 글·줄 번호와 함께 `from blocklab_* import *` 꼴로 고치기)가 끝나면
 * 이 목록을 비우고 지운다. 그동안 글자 그대로 왕복(roundtrip.test.ts)·함수 블록 보호 테스트(visibleFunctions.test.ts)가 이 파일들만 건너뛴다.
 */
export const PENDING_LIB_MIGRATION: readonly string[] = [
  // RFID: card_present()·card_uid() 도우미 def → card_present(rc522)·card_uid(rc522) + from blocklab_rfid import *
  "08-access-control/design_access.py",
  "08-access-control/extra1_auto_close.py",
  "08-access-control/extra2_toggle.py",
  "08-access-control/extra3_rgb_random.py",
  "08-access-control/mission_allowed_list.py",
  "08-access-control/mission_led.py",
  "08-access-control/step1_read_uid.py",
  "08-access-control/step3_access_control.py",
  "09-oled-access/extra1_count.py",
  "09-oled-access/extra2_names.py",
  "09-oled-access/mission_countdown.py",
  "09-oled-access/step3_access_display.py",
  "22-rfid/design_led.py",
  "22-rfid/mission_open_deny.py",
  "22-rfid/step1_read_uid.py",
  // 웹: wifi_connect·web_start·web_accept·web_send·web_page·web_send_file 도우미 def → from blocklab_net import *
  "25-web-led/design_blink.py",
  "25-web-led/mission_led_state.py",
  "25-web-led/step1_web_page.py",
  "25-web-led/step2_web_led.py",
  "26-web-sensors/design_hot_board.py",
  "26-web-sensors/mission_data_light.py",
  "26-web-sensors/step1_web_page.py",
  "26-web-sensors/step2_web_json.py",
  "37-mood-light/design_sleep_timer.py",
  "37-mood-light/step2_web_color.py",
  "38-disaster-alarm/design_alarm_web.py",
  "38-disaster-alarm/step2_web_status.py",
  "38-disaster-alarm/step3_web_app.py",
  "39-sensor-board/design_pir_banner.py",
  "39-sensor-board/step2_web_board.py",
  "39-sensor-board/step3_app_server.py",
];
