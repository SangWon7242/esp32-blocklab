import type { Chapter } from "./schema";
import { allSteps } from "./gating";
import { TRACK_NAME } from "./tracks";

/*
 * 챕터 찾기 (lib-v1.0.6). 순수 함수 — React·DOM·Blockly 를 쓰지 않아 core 입구(허브 서버)에서도 쓴다.
 *
 * 찾는 곳: 번호(S14·F4) · 제목 · 부제 · 장치(코드·준비물에서 알아낸 초음파·OLED·서보…) · 준비물 · 트랙 이름 · 교과 · SDG ·
 *          태그(호스트가 붙인 tags) · 요약 · 목표(내용·생각 목표, 성공 기준) · 단계 제목 · 원리 글.
 * 한글 검색: 공백·대소문자·문장 부호(· - _ 등)는 무시하고, 낱말을 여러 개 쓰면 모두 맞아야(AND) 한다.
 *          자음만 쓴 낱말(ㅊㅇㅍ)은 초성으로 맞춘다 (초음파). 번호(S1)는 번호 전체가 같을 때만 맞는다 (S1 이 S14 에 걸리지 않게).
 * 결과마다 어디서 맞았는지(matchedIn)와 강조용 조각(snippets: 글 + 맞은 범위)을 준다.
 */

/** 맞은 자리 이름 (화면에 그대로 보여 줄 수 있는 우리말) */
export type ChapterSearchField =
  | "번호" | "제목" | "부제" | "장치" | "준비물" | "트랙" | "교과" | "SDG" | "태그" | "요약" | "목표" | "단계" | "원리";

/** 찾을 수 있는 챕터: 검사한 챕터(LoadedChapter 의 files 가 있으면 코드에서 장치를 알아낸다) + 호스트가 붙인 태그 */
export type SearchableChapter = Chapter & { files?: Readonly<Record<string, string>>; tags?: readonly string[] };

/** 강조용 조각: text 를 차례대로 이어 붙이면 보여 줄 글, match 가 true 인 조각이 맞은 부분 */
export type SearchSnippetPart = { text: string; match: boolean };

export type ChapterSearchSnippet = {
  field: ChapterSearchField;
  /** 보여 줄 글 (길면 맞은 곳 둘레만 잘라 앞뒤에 … ) */
  text: string;
  /** text 안에서 맞은 범위 [시작, 끝) — 겹치지 않고 차례대로 */
  ranges: [number, number][];
  /** text 를 맞은 부분 / 아닌 부분으로 나눈 것 (그대로 <mark> 로 그리면 된다) */
  parts: SearchSnippetPart[];
};

export type ChapterSearchHit<C extends SearchableChapter = SearchableChapter> = {
  chapter: C;
  id: string;
  /** 클수록 잘 맞음 (번호·제목 > 장치·부제 > 준비물 … > 원리). 빈 검색어는 0 */
  score: number;
  /** 맞은 자리 (중복 없이, FIELD_ORDER 순) */
  matchedIn: ChapterSearchField[];
  /** 맞은 자리별 강조용 조각 (자리마다 하나, FIELD_ORDER 순) */
  snippets: ChapterSearchSnippet[];
};

/** 색인 한 칸: 자리 이름 + 보여 줄 글 + 맞춰 볼 글(정규화·초성)과 원래 글 위치 */
type IndexedText = { field: ChapterSearchField; text: string; norm: string; cho: string; map: number[] };

export type ChapterSearchEntry<C extends SearchableChapter = SearchableChapter> = { chapter: C; texts: IndexedText[] };
export type ChapterSearchIndex<C extends SearchableChapter = SearchableChapter> = { entries: ChapterSearchEntry<C>[] };

/** 화면에 보일 자리 순서이자 점수 순서 */
export const FIELD_ORDER: readonly ChapterSearchField[] = [
  "번호", "제목", "장치", "부제", "준비물", "태그", "트랙", "교과", "SDG", "요약", "목표", "단계", "원리",
];
const FIELD_WEIGHT: Record<ChapterSearchField, number> = {
  번호: 100, 제목: 60, 장치: 40, 부제: 30, 준비물: 25, 태그: 25, 트랙: 20, 교과: 20, SDG: 20, 요약: 12, 목표: 8, 단계: 10, 원리: 6,
};

/**
 * 장치 이름표: 코드(같은 폴더 .py)나 준비물 이름에 나오면 그 챕터의 "장치"가 된다.
 * name 은 화면에 보일 이름, aliases 는 같은 뜻으로 찾을 말 (영어 이름·부품 번호), code 는 코드에서 그 장치를 알아보는 꼴.
 */
export const DEVICE_TERMS: readonly { name: string; aliases: readonly string[]; code?: RegExp }[] = [
  { name: "초음파 센서", aliases: ["초음파", "거리 센서", "ultrasonic", "HC-SR04"], code: /get_distance\s*\(|\btrig\s*=\s*Pin\(/ },
  { name: "OLED 화면", aliases: ["OLED", "ssd1306", "디스플레이"], code: /\bssd1306\b/ },
  { name: "서보 모터", aliases: ["서보", "servo", "SG90"], code: /\bservo\s*=\s*PWM\(/ },
  { name: "온습도 센서", aliases: ["온도", "습도", "DHT11", "dht"], code: /\bimport\s+dht\b|\bdht\.DHT/ },
  { name: "RFID", aliases: ["RFID 카드", "MFRC522", "카드 읽기"], code: /\bmfrc522/ },
  { name: "키패드", aliases: ["keypad"], code: /\bKeyPad\b|\bkeypad\./ },
  { name: "IR 리모컨", aliases: ["적외선", "리모컨", "IR"], code: /\birGetCMD\b|\bir_read\b/ },
  { name: "조이스틱", aliases: ["joystick"], code: /\brocker_[xy]\b|\bjoystick\b/ },
  { name: "터치 패드", aliases: ["터치", "touch"], code: /\bTouchPad\(/ },
  { name: "WiFi", aliases: ["와이파이", "무선", "network"], code: /\bnetwork\.WLAN\(|\bwifi_connect\(/ },
  { name: "웹서버", aliases: ["웹", "web", "socket", "웹페이지"], code: /\bsocket\.socket\(|\bweb_start\(/ },
  { name: "부저", aliases: ["버저", "buzzer", "피에조", "멜로디"], code: /\bbuzzer\s*=\s*(?:Pin|PWM)\(/ },
  { name: "RGB LED", aliases: ["RGB", "삼색 LED"], code: /\b(?:red|rgb_r)\s*=\s*PWM\(/ },
  { name: "7세그먼트", aliases: ["세븐 세그먼트", "디지털 튜브", "74HC595", "FND", "seven segment"], code: /\bseg7\b|\b74HC595\b|^si\s*=\s*Pin\(/im },
  { name: "빛 센서", aliases: ["밝기 센서", "조도 센서", "포토레지스터", "light"], code: /\blight\s*=\s*ADC\(/ },
  { name: "소리 센서", aliases: ["마이크", "박수", "sound"], code: /\bsound\s*=\s*ADC\(/ },
  { name: "가변 저항", aliases: ["다이얼", "포텐셔미터", "knob"], code: /\bknob\s*=\s*ADC\(/ },
  { name: "불꽃 센서", aliases: ["flame", "화재"], code: /\bflame\s*=\s*ADC\(/ },
  { name: "인체 감지 센서", aliases: ["PIR", "사람 감지", "인체감지"], code: /\bpir\s*=\s*Pin\(/ },
  { name: "기울기 스위치", aliases: ["틸트", "tilt"], code: /\btilt\s*=\s*Pin\(/ },
  { name: "DC 모터", aliases: ["선풍기", "팬", "fan", "motor"], code: /\b(?:fan|motor)\w*\s*=\s*(?:Pin|PWM)\(/ },
  { name: "버튼", aliases: ["button", "누름 버튼"], code: /\b(?:button|btn)\w*\s*=\s*Pin\(/ },
  { name: "LED", aliases: ["엘이디", "led"], code: /\bled\w*\s*=\s*(?:Pin|PWM)\(/i },
];

/* ---------- 정규화 ---------- */

/** 맞춰 볼 때 지우는 글자: 공백과 낱말을 잇는 문장 부호 (· - _ / . , : ; ! ? 따옴표 괄호 ** ` 등) */
const SKIP = /[\s·•\-_/.,:;!?'"“”‘’()[\]{}<>「」『』《》*`~—–|+=…]/u;

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** 한 글자의 초성 (한글 음절이 아니면 그대로) */
function choOf(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return CHO[Math.floor((code - 0xac00) / 588)];
  return ch;
}

/** 글 → 맞춰 볼 글(소문자, 공백·부호 뺌) + 그 글자의 원래 위치 + 초성 글 */
function normalizeWithMap(text: string): { norm: string; cho: string; map: number[] } {
  let norm = "";
  let cho = "";
  const map: number[] = [];
  const s = text.normalize("NFC");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (SKIP.test(ch)) continue;
    const lower = ch.toLowerCase();
    norm += lower;
    cho += choOf(lower);
    map.push(i);
  }
  return { norm, cho, map };
}

/** 검색어를 맞춰 볼 꼴로 (공백·대소문자·부호 무시). 테스트·호스트용 */
export function normalizeSearchText(text: string): string {
  return normalizeWithMap(text).norm;
}

/** 글의 초성 글 ("초음파 센서" → "ㅊㅇㅍㅅㅅ"). 공백·부호는 빠진다 */
export function chosungOf(text: string): string {
  return normalizeWithMap(text).cho;
}

/** 자음(ㄱ~ㅎ)만으로 된 낱말인가 — 그러면 초성으로 맞춘다 */
function isChosungTerm(term: string): boolean {
  return term.length > 0 && [...term].every((c) => CHO.includes(c) || "ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ".includes(c));
}

/** 검색어 → 낱말들 (공백으로 나눔, 정규화 후 빈 낱말은 뺌, 겹치는 낱말 하나로) */
export function parseSearchQuery(query: string): string[] {
  const terms = query.trim().split(/\s+/).map(normalizeSearchText).filter(Boolean);
  return [...new Set(terms)];
}

/* ---------- 색인 ---------- */

/** 보여 줄 글: markdown 굵게·코드 표시를 지우고 줄바꿈·겹공백을 한 칸으로 */
function displayText(text: string): string {
  return text.replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();
}

function indexed(field: ChapterSearchField, raw: string): IndexedText {
  const text = displayText(raw);
  return { field, text, ...normalizeWithMap(text) };
}

/** 챕터가 쓰는 장치 이름 (DEVICE_TERMS 순). 코드 파일 또는 준비물 이름에서 알아낸다 */
export function chapterDevices(chapter: SearchableChapter): string[] {
  const code = Object.values(chapter.files ?? {}).join("\n");
  const materials = normalizeSearchText((chapter.materials ?? []).map((m) => m.name).join(" "));
  return DEVICE_TERMS.filter((d) =>
    (d.code && d.code.test(code)) || [d.name, ...d.aliases].some((a, i) => {
      const n = normalizeSearchText(a);
      // 짧은 영어 별칭(ir, web…)은 다른 낱말 속에 섞여 들어가기 쉬워 준비물 맞춤에는 이름(i = 0)만 쓴다
      return n.length >= 2 && (i === 0 || !/^[a-z]{1,3}$/.test(n)) && materials.includes(n);
    }),
  ).map((d) => d.name);
}

function chapterTexts(chapter: SearchableChapter): IndexedText[] {
  const out: IndexedText[] = [];
  const add = (field: ChapterSearchField, text: string | undefined) => {
    if (text && text.trim()) out.push(indexed(field, text));
  };
  add("번호", chapter.label);
  add("제목", chapter.title);
  add("부제", chapter.subtitle);
  for (const name of chapterDevices(chapter)) {
    const d = DEVICE_TERMS.find((t) => t.name === name)!;
    add("장치", [d.name, ...d.aliases].join(" · "));
  }
  for (const m of chapter.materials ?? []) add("준비물", m.note ? `${m.name} — ${m.note}` : m.name);
  for (const t of chapter.tags ?? []) add("태그", t);
  add("트랙", TRACK_NAME[chapter.track]);
  for (const s of chapter.subjects ?? []) add("교과", s);
  for (const n of chapter.sdg ?? []) add("SDG", `SDG ${n}`);
  add("요약", chapter.summary);
  add("목표", chapter.goals?.content);
  add("목표", chapter.goals?.thinking);
  for (const c of chapter.successCriteria ?? []) add("목표", c);
  for (const s of allSteps(chapter)) add("단계", s.title);
  add("원리", chapter.principle?.body);
  return out;
}

/** 챕터들의 찾기 색인. 챕터가 바뀌지 않으면 한 번만 만들어 두고 searchChapters 에 넘긴다 */
export function buildChapterSearchIndex<C extends SearchableChapter>(chapters: readonly C[]): ChapterSearchIndex<C> {
  return { entries: chapters.map((chapter) => ({ chapter, texts: chapterTexts(chapter) })) };
}

/* ---------- 맞추기 ---------- */

/** 한 낱말이 한 글에서 맞은 원래 글 범위들 (없으면 빈 배열) */
function findRanges(t: IndexedText, term: string): [number, number][] {
  if (t.field === "번호") return t.norm === term ? [[t.map[0], t.map[t.map.length - 1] + 1]] : [];
  const hay = isChosungTerm(term) ? t.cho : t.norm;
  const ranges: [number, number][] = [];
  let from = 0;
  for (;;) {
    const at = hay.indexOf(term, from);
    if (at < 0) break;
    ranges.push([t.map[at], t.map[at + term.length - 1] + 1]);
    from = at + term.length;
  }
  return ranges;
}

/** 범위들을 차례대로 합친다 (겹치거나 맞닿으면 하나로) */
function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** 조각 글의 최대 길이 (넘으면 첫 맞은 곳 둘레만) */
export const SNIPPET_MAX = 80;

/** 글 + 맞은 범위 → 보여 줄 조각 (길면 첫 맞은 곳 둘레를 잘라 … 를 붙인다) */
export function makeSnippet(field: ChapterSearchField, text: string, ranges: [number, number][], max = SNIPPET_MAX): ChapterSearchSnippet {
  let start = 0;
  let end = text.length;
  if (text.length > max && ranges.length) {
    const first = ranges[0];
    start = Math.max(0, Math.min(first[0] - Math.floor(max / 3), text.length - max));
    end = Math.min(text.length, start + max);
  } else if (text.length > max) {
    end = max;
  }
  const lead = start > 0 ? "…" : "";
  const tail = end < text.length ? "…" : "";
  const body = text.slice(start, end);
  const shifted = ranges
    .map(([a, b]): [number, number] => [Math.max(a, start) - start + lead.length, Math.min(b, end) - start + lead.length])
    .filter(([a, b]) => b > a);
  const shown = lead + body + tail;
  const parts: SearchSnippetPart[] = [];
  let at = 0;
  for (const [a, b] of shifted) {
    if (a > at) parts.push({ text: shown.slice(at, a), match: false });
    parts.push({ text: shown.slice(a, b), match: true });
    at = b;
  }
  if (at < shown.length) parts.push({ text: shown.slice(at), match: false });
  return { field, text: shown, ranges: shifted, parts };
}

/**
 * 색인 한 칸(챕터 하나)을 검색어에 맞춘다. 낱말이 모두 어딘가에 맞으면 결과, 하나라도 안 맞으면 null.
 * 빈 검색어면 점수 0 · 맞은 자리 없음으로 결과를 돌려준다 (목록을 그대로 보여 주도록).
 */
export function matchChapter<C extends SearchableChapter>(entry: ChapterSearchEntry<C>, query: string): ChapterSearchHit<C> | null {
  const terms = parseSearchQuery(query);
  const { chapter } = entry;
  if (!terms.length) return { chapter, id: chapter.id, score: 0, matchedIn: [], snippets: [] };
  const hitRanges = new Map<IndexedText, [number, number][]>();
  let score = 0;
  for (const term of terms) {
    let best = 0;
    for (const t of entry.texts) {
      const ranges = findRanges(t, term);
      if (!ranges.length) continue;
      hitRanges.set(t, [...(hitRanges.get(t) ?? []), ...ranges]);
      // 제목이 그 낱말로 시작하면 조금 더
      const bonus = t.field === "제목" && t.norm.startsWith(term) ? 10 : 0;
      best = Math.max(best, FIELD_WEIGHT[t.field] + bonus);
    }
    if (!best) return null;
    score += best;
  }
  const matchedIn = FIELD_ORDER.filter((f) => [...hitRanges.keys()].some((t) => t.field === f));
  const snippets = matchedIn.map((field) => {
    // 그 자리에서 낱말이 가장 많이 맞은 글 하나
    const [t, ranges] = [...hitRanges.entries()].filter(([x]) => x.field === field).sort((a, b) => b[1].length - a[1].length)[0];
    return makeSnippet(field, t.text, mergeRanges(ranges));
  });
  return { chapter, id: chapter.id, score, matchedIn, snippets };
}

/**
 * 챕터 찾기: 챕터 배열이나 미리 만든 색인을 받아, 맞는 챕터를 점수 높은 순(같으면 원래 순서)으로.
 * 빈 검색어면 모든 챕터를 원래 순서대로 돌려준다.
 */
export function searchChapters<C extends SearchableChapter>(
  source: readonly C[] | ChapterSearchIndex<C>,
  query: string,
): ChapterSearchHit<C>[] {
  // 배열에도 entries 메서드가 있어 "entries" in 으로는 가를 수 없다
  const index = Array.isArray(source) ? buildChapterSearchIndex(source as readonly C[]) : (source as ChapterSearchIndex<C>);
  return index.entries
    .map((e, i) => ({ hit: matchChapter(e, query), i }))
    .filter((x): x is { hit: ChapterSearchHit<C>; i: number } => x.hit !== null)
    .sort((a, b) => b.hit.score - a.hit.score || a.i - b.i)
    .map((x) => x.hit);
}
