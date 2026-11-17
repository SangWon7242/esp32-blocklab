import type { Behavior } from "../engine";

/** 12장 멜로디 버저 — 설계(design_up_down.py): 25번 부저로 도레미파솔라시도를 0.3초씩 올라갔다가 거꾸로 내려온 뒤 조용해진다 (한 번만) */
const NOTES = [262, 294, 330, 349, 392, 440, 494, 523];
const SONG = [...NOTES, ...[...NOTES].reverse()];

const behavior: Behavior = (b) => {
  const k = Math.floor(b.t / 0.3);
  b.tone(25, k < SONG.length ? SONG[k] : 0);
};
export default behavior;
