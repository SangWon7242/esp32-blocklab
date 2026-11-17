import type { Behavior } from "../engine";

/*
 * 챕터마다 「완성 작품의 동작」: 그 챕터 마지막 코드(미션 · 설계 단계)가 하는 일을 학생 코드와 같은 핀 번호로 옮긴 것.
 * 3D 에서 버튼을 누르거나 자동차를 끌면 이 동작이 실행되어 LED · 서보 · OLED 가 움직인다.
 * 파일 하나에 챕터 하나 (chNN.ts). 여기서 모은다. 동작이 없는 챕터는 실행 단추가 보이지 않는다.
 */

const modules = import.meta.glob<{ default: Behavior }>("./ch*.ts", { eager: true });

const BY_CHAPTER = new Map<string, Behavior>();
for (const [path, mod] of Object.entries(modules)) {
  const m = /\.\/ch(\d+)\.ts$/.exec(path);
  if (m) BY_CHAPTER.set(m[1], mod.default);
}

/** 챕터 id ("17-ultrasonic") → 그 챕터의 동작 */
export function behaviorFor(chapterId: string | undefined): Behavior | undefined {
  const n = chapterId ? /^(\d+)-/.exec(chapterId)?.[1] : undefined;
  return n ? BY_CHAPTER.get(n) : undefined;
}

export function chaptersWithBehavior(): string[] {
  return [...BY_CHAPTER.keys()].sort();
}
