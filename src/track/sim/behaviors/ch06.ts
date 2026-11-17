import type { Behavior } from "../engine";

/**
 * 6장 7세그먼트 — 설계(design_seg7.py): 3 → 2 → 1 을 1초씩 보이고, 0 에 점을 찍어 2초 보인 뒤 모두 끈다 (한 번만)
 * 74HC595 로 비트를 보내는 대신 보이는 글자를 바로 정한다. 점(dot)은 3D 숫자판이 그리지 못해 0 만 보인다
 */
const behavior: Behavior = (b) => {
  const t = b.t;
  if (t < 1) b.seg7("3");
  else if (t < 2) b.seg7("2");
  else if (t < 3) b.seg7("1");
  else if (t < 5) b.seg7("0."); // show_digit(0, True) — 소수점까지
  else b.seg7(null); // hc595_shift(0)
};
export default behavior;
