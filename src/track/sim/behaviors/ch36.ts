import type { Behavior } from "../engine";
import { program, randint, type Program } from "./program";

/**
 * 36장 기억력 게임 — 설계 design_memory_game.py: 14번 버튼으로 시작하면 OLED 에 A · B · C 문제를 차례로 보이고,
 * 터치 패드 32(A) · 33(B) · 27(C) 로 같은 순서를 맞히면 OK 와 함께 한 글자 늘고, 틀리면 END 와 점수
 */
const NAMES = ["A", "B", "C"];

const behavior: Behavior = program(function* (b) {
  const problem: number[] = [];
  const answer: number[] = [];
  let score = 0;
  const touched = () => b.touch(32) < 300 || b.touch(33) < 300 || b.touch(27) < 300;

  function* showProblem(): Program {
    for (const n of problem) {
      b.oled(["", NAMES[n]]);
      yield 0.5;
      b.oled([]);
      yield 0.2;
    }
  }
  function* pick(n: number): Program {
    answer.push(n);
    b.oled(["", NAMES[n]]);
    while (touched()) yield 0.05;
    b.oled([]);
  }

  b.oled(["", "PRESS START"]);
  while (b.read(14) === 1) yield 0.05;
  for (let i = 0; i < 3; i++) problem.push(randint(0, 2));
  yield* showProblem();
  for (;;) {
    if (b.touch(32) < 300) yield* pick(0);
    else if (b.touch(33) < 300) yield* pick(1);
    else if (b.touch(27) < 300) yield* pick(2);
    if (answer.length === problem.length) {
      let correct = 0;
      for (let i = 0; i < problem.length; i++) if (answer[i] === problem[i]) correct += 1;
      if (correct === problem.length) {
        b.oled(["", "OK"]);
        score += 1;
        answer.length = 0;
        problem.push(randint(0, 2));
        yield 1;
        yield* showProblem();
      } else {
        b.oled(["", "END", `SCORE ${score}`]);
        break;
      }
    }
    yield 0.05;
  }
});
export default behavior;
