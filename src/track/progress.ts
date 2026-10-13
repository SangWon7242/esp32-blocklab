import { z } from "zod";

/** localStorage 키. 형식이 바뀌면 v2 로 올리고 옮기는 코드를 둔다 */
export const STORAGE_KEY = "esp32-blocklab:v1";

export const StepRecordSchema = z.object({
  /** locked 는 보통 관문이 계산하지만 기록 형식은 기준 문서 9장을 따른다 */
  status: z.enum(["locked", "open", "done"]),
  /** 학생 입력: 글·답·코드(블록 JSON 과 파이썬 글) 등 단계 유형마다 자유 */
  input: z.record(z.unknown()),
  attempts: z.number().int().nonnegative(),
  /** ISO 시각 */
  updatedAt: z.string(),
});
export type StepRecord = z.infer<typeof StepRecordSchema>;

export const ProgressSchema = z.object({
  version: z.literal(1),
  /** chapterId → stepId → 기록 */
  chapters: z.record(z.record(StepRecordSchema)),
  /** 자유 코딩 작업 (형식은 lab 쪽이 정한다) */
  lab: z.unknown().optional(),
});
export type Progress = z.infer<typeof ProgressSchema>;

export function emptyProgress(): Progress {
  return { version: 1, chapters: {} };
}

/** 기준 문서 9장. 2단계 SupabaseProgressStore 도 같은 모양이라 모두 비동기 */
export interface ProgressStore {
  load(): Promise<Progress>;
  saveStep(chapterId: string, stepId: string, record: StepRecord): Promise<void>;
  saveLabProject(lab: unknown): Promise<void>;
  exportJson(): Promise<string>;
  /** 형식이 틀리면 throw 하고 기존 기록은 그대로 둔다 */
  importJson(text: string): Promise<void>;
  clear(): Promise<void>;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 글을 진행 기록으로. 형식이 틀리면 이유를 담아 throw */
export function parseProgress(text: string): Progress {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON 파일이 아닙니다");
  }
  const r = ProgressSchema.safeParse(data);
  if (!r.success) {
    const v = (data as { version?: unknown } | null)?.version;
    if (v !== undefined && v !== 1) throw new Error(`지원하지 않는 버전입니다 (version ${String(v)})`);
    throw new Error(`진행 기록 형식이 아닙니다: ${r.error.issues.map((i) => i.path.join(".") || "(전체)").join(", ")}`);
  }
  return r.data;
}

/** 탭이 닫히면 사라지는 저장소 (localStorage 를 쓸 수 없을 때) */
export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** 브라우저 localStorage. 접근만 해도 SecurityError 가 나는 환경(차단된 쿠키·일부 사생활 모드)이면 undefined */
function browserStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/** 실제로 쓰고 지울 수 있는지 한 번 시험한다 */
function writable(storage: StorageLike): boolean {
  const probe = `${STORAGE_KEY}:probe`;
  try {
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export class LocalProgressStore implements ProgressStore {
  private readonly storage: StorageLike;
  /** false 면 localStorage 를 쓸 수 없어 메모리에만 남는다 (새로 고치면 사라짐) */
  readonly persistent: boolean;
  constructor(storage?: StorageLike) {
    const candidate = storage ?? browserStorage();
    this.persistent = candidate !== undefined && writable(candidate);
    this.storage = this.persistent && candidate ? candidate : new MemoryStorage();
  }

  /** 저장된 글이 깨져 있으면 원문을 :corrupt 키에 옮겨 두고 빈 기록으로 시작한다 */
  private read(): Progress {
    const text = this.storage.getItem(STORAGE_KEY);
    if (text === null) return emptyProgress();
    try {
      return parseProgress(text);
    } catch {
      this.storage.setItem(`${STORAGE_KEY}:corrupt`, text);
      this.storage.removeItem(STORAGE_KEY);
      return emptyProgress();
    }
  }

  private write(p: Progress): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(p));
  }

  async load(): Promise<Progress> {
    return this.read();
  }

  async saveStep(chapterId: string, stepId: string, record: StepRecord): Promise<void> {
    const p = this.read();
    (p.chapters[chapterId] ??= {})[stepId] = StepRecordSchema.parse(record);
    this.write(p);
  }

  async saveLabProject(lab: unknown): Promise<void> {
    const p = this.read();
    p.lab = lab;
    this.write(p);
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(this.read(), null, 2);
  }

  async importJson(text: string): Promise<void> {
    this.write(parseProgress(text));
  }

  async clear(): Promise<void> {
    this.storage.removeItem(STORAGE_KEY);
  }
}
