import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLibFiles } from "./libs";

afterEach(() => vi.unstubAllGlobals());

describe("fetchLibFiles", () => {
  it("BASE_URL/lib/<이름> 에서 읽어 이름과 내용을 돌려준다", async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(`# ${url}`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const files = await fetchLibFiles(["ssd1306.py", "gfx.py"]);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([`${import.meta.env.BASE_URL}lib/ssd1306.py`, `${import.meta.env.BASE_URL}lib/gfx.py`]);
    expect(files).toEqual([
      { name: "ssd1306.py", text: `# ${import.meta.env.BASE_URL}lib/ssd1306.py` },
      { name: "gfx.py", text: `# ${import.meta.env.BASE_URL}lib/gfx.py` },
    ]);
  });
  it("빈 목록이면 fetch 하지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchLibFiles([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("못 읽으면 파일 이름을 담은 한국어 오류", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(fetchLibFiles(["ssd1306.py"])).rejects.toThrow("ssd1306.py 라이브러리를 불러오지 못했어요");
  });
});
