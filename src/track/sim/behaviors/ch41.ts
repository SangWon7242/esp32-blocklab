import type { Behavior } from "../engine";
import { program, randint } from "./program";

/**
 * 41장 폭탄 피하기 — 설계 design_bomb_game.py: 폭탄 셋이 저마다 다른 빠르기로 떨어지고, A(14) · B(27) 버튼으로
 * 다섯 칸을 오가며 피한다. 피하면 점수가 오르고 점점 빨라지며, 맞으면 END 와 점수 · 25번 부저 낮은 음.
 * OLED 그림은 글자로: 한 줄이 한 층(위 → 아래), # 폭탄 · @ 나 · X 맞음, 맨 윗줄 끝에 점수
 */
const behavior: Behavior = program(function* (b) {
  let player = 2;
  let score = 0;
  let playing = true;
  const bombX = [0, 2, 4];
  const bombY = [0, 0, 0];
  const nextTime = [0, 0, 0];

  const moveBomb = (i: number) => {
    if (bombY[i] === 4) {
      if (bombX[i] === player) playing = false;
      else score += 1;
      bombY[i] = 0;
      bombX[i] = randint(0, 4);
    } else {
      bombY[i] = bombY[i] + 1;
    }
    let gap = 900 - score * 50;
    if (gap < 200) gap = 200;
    nextTime[i] = b.t + randint(200, gap) / 1000;
  };

  const draw = () => {
    const rows: string[] = [];
    for (let y = 0; y < 5; y++) {
      const cells: string[] = [];
      for (let x = 0; x < 5; x++) {
        const bomb = [0, 1, 2].some((i) => bombX[i] === x && bombY[i] === y);
        const me = y === 4 && x === player;
        cells.push(bomb && me ? "X" : bomb ? "#" : me ? "@" : ".");
      }
      rows.push(cells.join(" "));
    }
    rows[0] += `  ${score}`;
    b.oled(rows);
  };

  b.tone(25, 0);
  while (playing) {
    if (b.read(14) === 0 && player > 0) player = player - 1;
    if (b.read(27) === 0 && player < 4) player = player + 1;
    for (let i = 0; i < 3; i++) if (b.t - nextTime[i] >= 0) moveBomb(i);
    draw();
    yield 0.1;
  }
  b.oled(["", "END", `SCORE ${score}`]);
  b.tone(25, 220);
  yield 0.5;
  b.tone(25, 0);
});
export default behavior;
