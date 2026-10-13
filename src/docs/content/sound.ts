import type { BlockContent } from "../types";

const BEEPER_SETUP = "beeper = PWM(Pin(15))\nbeeper.freq(440)\nbeeper.duty(0)";

/** 음 하나를 울리는 네 줄 (음 높이·음 이름 블록이 만드는 코드) */
const tone = (hz: number | string, sec: number | string, indent = "") =>
  [`beeper.freq(${hz})`, "beeper.duty(512)", `time.sleep(${sec})`, "beeper.duty(0)"].map((l) => indent + l).join("\n");

/** 소리 카테고리 블록 설명 (src/devices/specs/sound.ts) */
export const soundContent: Record<string, BlockContent> = {
  dev_buzzer_setup: {
    concept: "능동 부저를 출력 핀에 준비하고 이름을 붙여요. 능동 부저는 안에 소리를 만드는 회로가 있어서 켜기만 하면 정해진 높이로 삐 소리가 납니다. 켜고 끄는 것은 핀 켜기·끄기 블록(buzzer.value(1)·buzzer.value(0))으로 해요.",
    example: { title: "0.5초 동안 삐 울리기", code: "buzzer = Pin(15, Pin.OUT)\nbuzzer.value(1)\ntime.sleep(0.5)\nbuzzer.value(0)" },
    tips: [
      "음 높이를 바꾸고 싶으면 수동 부저와 '소리 나는 부저' 블록을 써요.",
      "코드를 블록으로 바꾸면 핀 준비 블록(출력)으로 돌아와요. 코드가 같아서 뜻도 같아요.",
    ],
  },
  dev_beeper_setup: {
    concept: "수동 부저를 PWM 핀에 준비하고 이름을 붙여요. 수동 부저는 PWM 의 주파수(1초에 떨리는 횟수)대로 소리를 내서 도·레·미 같은 음을 연주할 수 있습니다. 처음에는 duty(0) 으로 조용히 두어요.",
    example: { title: "'라' 음 1초 울리기", code: `${BEEPER_SETUP}\n${tone(440, 1)}` },
  },
  dev_beeper_tone: {
    concept: "수동 부저로 정한 높이(Hz)의 음을 정한 초만큼 울려요. 주파수를 정하고(freq), 소리를 켜고(duty 512), 기다린 뒤, 소리를 끄는(duty 0) 네 줄이 만들어집니다. 주파수가 클수록 높은 소리예요.",
    example: { title: "낮은 음에서 높은 음으로", code: `${BEEPER_SETUP}\n${tone(262, 0.3)}\n${tone(523, 0.3)}\n${tone(1047, 0.3)}` },
    tips: ["사람이 들을 수 있는 소리는 20~20000Hz 예요. 440Hz 가 '라' 음이에요."],
  },
  dev_beeper_note: {
    concept: "도·레·미 처럼 음 이름을 골라 박 수만큼 울려요. 고른 음을 주파수로 바꾸고, 한 박을 0.5초로 쳐서 time.sleep(1 * 0.5) 처럼 기다립니다. 여러 개를 이어 붙이면 노래를 만들 수 있어요.",
    example: { title: "도, 레, 미 연주하기", code: `${BEEPER_SETUP}\n${tone(262, "1 * 0.5")}\n${tone(294, "1 * 0.5")}\n${tone(330, "2 * 0.5")}` },
    tips: ["코드를 블록으로 바꾸면 'Hz 음을 초 울리기' 블록으로 돌아와요. 코드가 같아서 뜻도 같아요."],
  },
  dev_beeper_stop: {
    concept: "수동 부저의 소리를 꺼요. 코드로는 beeper.duty(0) 이고, 떨림의 세기를 0 으로 만들어 소리를 멈춥니다. 반복 안에서 소리를 켰다가 조건에 따라 멈출 때 써요.",
    example: {
      title: "버튼을 누를 때만 소리 내기",
      code: `${BEEPER_SETUP}\nbutton = Pin(14, Pin.IN, Pin.PULL_UP)\nwhile True:\n    if button.value() == 0:\n${tone(440, 0.2, "        ")}\n    else:\n        beeper.duty(0)`,
    },
  },
};
