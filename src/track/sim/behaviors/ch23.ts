import { once, type Behavior } from "../engine";

/**
 * 23장 버튼 왕 — 설계 「한 번 · 두 번 · 길게」(design_button_king.py): 14번 버튼을 0.5초 넘게 누르면 파랑,
 * 짧게 한 번 누르고 0.4초 기다리면 빨강, 0.4초 안에 두 번 이상 누르면 초록으로 RGB LED(27 · 25 · 26)를 켠다
 */
const behavior: Behavior = (b) => {
  const s = b.state as { clicks: number; last: number; start?: number; wake?: number };
  const setColor = (r: number, g: number, bl: number) => {
    b.pwm(27, Math.floor((r * 1023) / 255) / 1023);
    b.pwm(25, Math.floor((g * 1023) / 255) / 1023);
    b.pwm(26, Math.floor((bl * 1023) / 255) / 1023);
  };
  if (once(b)) {
    s.clicks = 0;
    s.last = b.t; // last = time.ticks_ms()
  }
  if (b.t < (s.wake ?? 0)) return; // time.sleep(0.05)
  if (s.start !== undefined) {
    // while button.value() == 0: 뗄 때까지 기다린다
    if (b.read(14) === 0) return;
    const held = (b.t - s.start) * 1000;
    s.start = undefined;
    s.wake = b.t + 0.05;
    if (held >= 500) {
      setColor(0, 0, 255);
      s.clicks = 0;
    } else {
      s.clicks = s.clicks + 1;
      s.last = s.wake;
    }
    return;
  }
  if (b.read(14) === 0) {
    s.start = b.t; // start = time.ticks_ms()
    return;
  }
  if (s.clicks > 0 && b.t - s.last > 0.4) {
    if (s.clicks === 1) setColor(255, 0, 0);
    else setColor(0, 255, 0);
    s.clicks = 0;
  }
};
export default behavior;
