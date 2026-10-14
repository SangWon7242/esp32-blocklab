import { parse } from "yaml";
import { ChapterSchema, type Chapter, type Rule } from "./schema";
import { allSteps } from "./gating";
import { chapterImageRefs } from "./images";

/** 검사를 마친 챕터 + 같은 폴더의 코드 파일 (이름 → 글) */
export type LoadedChapter = Chapter & { files: Record<string, string> };

/** 챕터가 이름으로 참조하는 코드 파일 (중복 없이, 나온 순서대로) */
export function codeRefs(chapter: Chapter): string[] {
  const refs: string[] = [];
  const add = (f: string | undefined) => {
    if (f && !refs.includes(f)) refs.push(f);
  };
  const addRules = (rules: readonly Rule[]) => rules.forEach((r) => "codeEquals" in r && add(r.codeEquals.file));
  for (const s of allSteps(chapter)) {
    switch (s.type) {
      case "predict":
      case "run":
      case "readcheck":
        add(s.code);
        break;
      case "mission":
        add(s.code);
        addRules(s.rules);
        add(s.answerCode);
        break;
      case "debug":
        s.symptoms.forEach((sym) => addRules(sym.rules));
        addRules(s.rules);
        add(s.answerCode);
        break;
      case "design":
        add(s.targetCode);
        break;
      case "reflect":
        add(s.lineExplain);
        break;
    }
  }
  return refs;
}

/** 챕터가 가리키는 그림 ("images/x.svg", 중복 없이, 나온 순서대로): 표지·부품·배선·단계 장면 */
export function imageRefs(chapter: Chapter): string[] {
  const refs: string[] = [];
  const add = (f: string | undefined) => {
    if (f && !refs.includes(f)) refs.push(f);
  };
  add(chapter.cover);
  chapter.materials?.forEach((m) => add(m.image));
  add(chapter.wiring?.image);
  for (const s of allSteps(chapter)) add(s.scene?.image);
  return refs;
}

/**
 * YAML 글과 같은 폴더의 코드 파일로 챕터를 만든다 (순수 함수 — 테스트는 fs 로 읽어 넘긴다).
 * dir 은 폴더 이름(챕터 id 와 같아야 함). images 를 주면(폴더의 "images/x.svg" 이름들) 그림 참조도 검사한다.
 * 형식·참조가 틀리면 어디가 틀렸는지 담아 throw.
 */
export function parseChapter(
  yamlText: string,
  files: Readonly<Record<string, string>>,
  dir: string,
  images?: readonly string[],
): LoadedChapter {
  const where = `content/chapters/${dir}/chapter.yaml`;
  const result = ChapterSchema.safeParse(parse(yamlText));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`${where} 형식 오류\n${issues}`);
  }
  const chapter = result.data;
  const errors: string[] = [];
  if (chapter.id !== dir) errors.push(`id "${chapter.id}" 가 폴더 이름 "${dir}" 과 다릅니다`);

  const seen = new Set<string>();
  for (const id of [...chapter.parts.map((p) => `part:${p.id}`), ...allSteps(chapter).map((s) => s.id)]) {
    if (seen.has(id)) errors.push(`id "${id.replace(/^part:/, "")}" 가 두 번 나옵니다`);
    seen.add(id);
  }
  for (const ref of codeRefs(chapter)) if (!(ref in files)) errors.push(`코드 파일 ${ref} 이 폴더에 없습니다`);
  if (images) for (const ref of imageRefs(chapter)) if (!images.includes(ref)) errors.push(`그림 ${ref} 이 폴더에 없습니다`);

  for (const s of allSteps(chapter)) {
    if (s.type !== "readcheck") continue;
    const lineCount = files[s.code]?.replace(/\n$/, "").split("\n").length ?? 0;
    s.questions.forEach((q, i) => {
      if (q.kind === "choice" && q.answer >= q.options.length) errors.push(`${s.id} 문항 ${i + 1}: 답 ${q.answer} 이 선택지 범위 밖입니다`);
      if (q.kind === "line" && q.answer > lineCount) errors.push(`${s.id} 문항 ${i + 1}: ${q.answer}번 줄이 ${s.code} 에 없습니다 (${lineCount}줄)`);
    });
  }
  if (errors.length) throw new Error(`${where}\n${errors.map((e) => `  ${e}`).join("\n")}`);
  return { ...chapter, files: { ...files } };
}

/** "/content/chapters/<dir>/<name>" → [dir, name] */
function split(path: string): [string, string] {
  const m = /\/content\/chapters\/([^/]+)\/([^/]+)$/.exec(path);
  if (!m) throw new Error(`알 수 없는 콘텐츠 경로 ${path}`);
  return [m[1], m[2]];
}

let cache: LoadedChapter[] | null = null;

/** content/chapters/* 의 모든 챕터를 order 순으로 (빌드 때 글로 묶인다) */
export function loadChapters(): LoadedChapter[] {
  if (cache) return cache;
  const yamls = import.meta.glob<string>("/content/chapters/*/chapter.yaml", { query: "?raw", import: "default", eager: true });
  const codes = import.meta.glob<string>("/content/chapters/*/*.py", { query: "?raw", import: "default", eager: true });
  const filesByDir: Record<string, Record<string, string>> = {};
  for (const [path, text] of Object.entries(codes)) {
    const [dir, name] = split(path);
    (filesByDir[dir] ??= {})[name] = text;
  }
  cache = Object.entries(yamls)
    .map(([path, text]) => {
      const [dir] = split(path);
      return parseChapter(text, filesByDir[dir] ?? {}, dir, chapterImageRefs(dir));
    })
    .sort((a, b) => a.order - b.order);
  return cache;
}

export function getChapter(id: string): LoadedChapter | undefined {
  return loadChapters().find((c) => c.id === id);
}
