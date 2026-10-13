/**
 * 콘텐츠 폴더의 .py 파일을 "<챕터 id>/<파일 이름>" 으로 찾는다.
 * 자유 코딩 화면이 ?code= 로 받은 파일을 처음 코드로 깔 때 쓴다 (YAML 은 읽지 않는다).
 */
const files = import.meta.glob<string>("/content/chapters/*/*.py", { query: "?raw", import: "default", eager: true });

/** 모르는 이름이거나 모양이 틀리면 undefined */
export function contentFile(ref: string | null | undefined): string | undefined {
  if (!ref || !/^[\w-]+\/[\w.-]+\.py$/.test(ref)) return undefined;
  return files[`/content/chapters/${ref}`];
}
