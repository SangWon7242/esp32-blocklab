import { every, type Behavior } from "../engine";

/**
 * 21장 OLED 화면 — 미션 「세는 이름표」(mission_name_tag.py): 1초마다 화면에 HELLO, I AM · MINJI 와
 * 0 부터 하나씩 커지는 수를 보여 준다
 * (설계 design_house.py 는 선 · 네모로 집을 그리는데, 시뮬레이션 OLED 는 글자 줄만 보여 줄 수 있어서 미션을 골랐다. 테두리 rect 도 그리지 못한다)
 */
const behavior: Behavior = (b) => {
  every(b, 1, () => {
    const count = (b.state.count as number | undefined) ?? 0;
    b.oled(["HELLO, I AM", "MINJI", String(count)]);
    b.state.count = count + 1;
  });
};
export default behavior;
