/** 보드에 함께 올릴 라이브러리 (public/lib/*.py) 읽기 */
export async function fetchLibFiles(names: string[]): Promise<Array<{ name: string; text: string }>> {
  const files: Array<{ name: string; text: string }> = [];
  for (const name of names) {
    let res: Response;
    try {
      res = await fetch(`${import.meta.env.BASE_URL}lib/${name}`);
    } catch (cause) {
      throw new Error(`${name} 라이브러리를 불러오지 못했어요`, { cause });
    }
    if (!res.ok) throw new Error(`${name} 라이브러리를 불러오지 못했어요 (${res.status})`);
    files.push({ name, text: await res.text() });
  }
  return files;
}
