/**
 * 챕터 그림: content/chapters/<id>/images/*.svg 를 빌드 때 글(SVG 원문)로 묶는다.
 * 콘텐츠는 그림을 "images/<이름>.svg" 로 가리킨다 (챕터 폴더 기준). 화면은 원문을 인라인 SVG 로 그린다.
 */
const svgs = import.meta.glob<string>("/content/chapters/*/images/*.svg", { query: "?raw", import: "default", eager: true });

/** "images/x.svg" 꼴인지 (schema 의 ImageRef 와 같은 모양) */
const REF = /^images\/[\w.-]+\.svg$/;

/** 챕터 폴더의 그림 원문. 모르는 이름이거나 모양이 틀리면 undefined */
export function chapterImage(chapterId: string, ref: string | null | undefined): string | undefined {
  if (!ref || !REF.test(ref) || !/^[\w-]+$/.test(chapterId)) return undefined;
  return svgs[`/content/chapters/${chapterId}/${ref}`];
}

/** 챕터 폴더에 있는 그림 이름들 ("images/x.svg") */
export function chapterImageRefs(chapterId: string): string[] {
  const prefix = `/content/chapters/${chapterId}/`;
  return Object.keys(svgs).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
}

/** 묶인 모든 그림 (경로 → 원문). 테스트용 */
export function allChapterImages(): Readonly<Record<string, string>> {
  return svgs;
}

/** 인라인에 넣으면 안 되는 것: script 요소, on* 처리기 속성, javascript: 주소 */
const SCRIPT = /<script\b[\s\S]*?(?:<\/script\s*>|\/>)/gi;
const HANDLER = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /\s+(?:xlink:)?href\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi;

/** 우리 파일만 쓰지만 방어로 한 번 더 거른다. XML 선언·DOCTYPE 도 인라인에선 뺀다 */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(SCRIPT, "")
    .replace(HANDLER, "")
    .replace(JS_URL, "")
    .trim();
}

/** 그림에 위험한 것이 있으면 그 이유 (없으면 null) — 콘텐츠 검사용 */
export function unsafeSvgReason(svg: string): string | null {
  if (/<script\b/i.test(svg)) return "<script> 가 있습니다";
  if (/\son[a-z]+\s*=/i.test(svg)) return "on* 처리기 속성이 있습니다";
  if (/javascript:/i.test(svg)) return "javascript: 주소가 있습니다";
  if (!/<svg\b/i.test(svg)) return "<svg> 요소가 없습니다";
  return null;
}
