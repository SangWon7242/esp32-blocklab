import type { Behavior } from "../engine";
import { idiv, program, randint } from "./program";

/**
 * 42장 달리기 게임 — 더 해 보기 extra_sound_speed.py (마지막 답 코드): 14번 버튼(IRQ)으로 시작 · 점프,
 * 벽돌이 오른쪽에서 다가오고 땅에서 부딪히면 GAME OVER. 점프는 25번 부저 높은 음, 충돌은 낮은 음,
 * 39번 손잡이로 한 칸 시간(160~60ms)을 정한다.
 * OLED 그림은 글자로: 맨 아래 줄이 땅(# 벽돌), @ 가 주인공(점프하면 윗줄로)
 */
const BUTTON = 14;

const game = program(function* (b) {
  const st = b.state as { pressed?: boolean };
  let playing = false;
  let blink = 0;
  let bricks = new Array(16).fill(0) as number[];
  let distance = 0;
  let jump = 0;
  b.tone(25, 0);
  for (;;) {
    let lines: string[];
    if (playing) {
      if (jump > 0) {
        jump = jump + 1;
        if (jump > 2) jump = 0;
      }
      if (st.pressed) {
        st.pressed = false;
        if (jump === 0) {
          jump = 1;
          b.tone(25, 880);
          yield 0.03;
          b.tone(25, 0);
        }
      }
      let next = 0;
      if (bricks[15] === 0 && randint(0, 2) === 0) next = 1;
      bricks.shift();
      bricks.push(next);
      distance = distance + 1;
      if (bricks[1] === 1 && jump === 0) {
        playing = false;
        b.oled(["", "GAME OVER", `SCORE ${idiv(distance, 8)}`]);
        b.tone(25, 220);
        yield 0.5;
        b.tone(25, 0);
        yield 1.5;
        st.pressed = false;
        lines = ["", "GAME OVER", `SCORE ${idiv(distance, 8)}`];
      } else {
        const ground: string[] = bricks.map((k) => (k ? "#" : "_"));
        const air = [" ".repeat(16).split(""), " ".repeat(16).split("")];
        if (jump === 0) ground[1] = "@";
        else air[jump - 1][1] = "@";
        lines = [`SCORE ${idiv(distance, 8)}`, "", air[1].join("").trimEnd(), air[0].join("").trimEnd(), ground.join("")];
      }
    } else {
      if (st.pressed) {
        st.pressed = false;
        playing = true;
        distance = 0;
        jump = 0;
        bricks = new Array(16).fill(0) as number[];
      }
      lines = blink % 10 < 5 ? ["", "PRESS START", "", "", "_".repeat(16)] : ["", "", "", "", "_@" + "_".repeat(14)];
    }
    b.oled(lines);
    blink = blink + 1;
    const wait = idiv((b.adc(39) - 0) * (60 - 160), 4095 - 0) + 160;
    yield wait / 1000;
  }
});

const behavior: Behavior = (b) => {
  // button.irq(trigger=Pin.IRQ_FALLING): 코드가 쉬는 동안에도 누른 순간을 기억한다
  const now = b.read(BUTTON);
  if (b.state.prev === 1 && now === 0) b.state.pressed = true;
  b.state.prev = now;
  game(b);
};
export default behavior;
