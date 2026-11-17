import type { Behavior } from "../engine";
import { program } from "./program";

/**
 * 체험 첫 신호 — 마지막 단계 미션 mission3_longer_cross.py: 평소에는 초록(16), 25번 보행자 버튼을 누르면
 * 노랑(14) 1초 → 빨강(13) 8초(사람이 건너요) → 다시 초록
 */
const behavior: Behavior = program(function* (b) {
  b.write(16, 1);
  for (;;) {
    if (b.read(25) === 0) {
      b.write(16, 0);
      b.write(14, 1);
      yield 1;
      b.write(14, 0);
      b.write(13, 1);
      yield 8;
      b.write(13, 0);
      b.write(16, 1);
    }
    yield 0.1;
  }
});
export default behavior;
