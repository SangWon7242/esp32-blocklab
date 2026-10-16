/*
 * Blockly media 경로 (lib-v1.0.1). Blockly.inject 의 `media` 옵션으로 넘긴다 — 효과음(click·delete·disconnect·drop mp3)과
 * 작업판 그림(sprites.svg: 확대 단추·휴지통), 아이콘·커서를 이 주소에서 읽는다.
 * Blockly 기본값(https://static.blockly.com/media/)은 허브 CSP(connect-src·img-src 'self')에 막히므로 자기 주소를 쓴다.
 *   - 기본값: `<BASE_URL>blocklab/media/` — 체험판은 "/esp32-blocklab/blocklab/media/"(GitHub Pages), 라이브러리는 "/blocklab/media/"
 *     파일은 빌드가 낸다(scripts/vite-blockly.ts: 체험판 dist/blocklab/media/, 라이브러리 dist-lib/media/)
 *   - 호스트는 HostProps.blocklyMediaPath 나 setBlocklyMediaPath() 로 바꾼다 (Provider 밖에서 쓰는 loadBlockTools·ProjectPreview 용)
 * Blockly 를 import 하지 않는다 (순수 경로 HostContext 가 쓴다).
 */
export const DEFAULT_BLOCKLY_MEDIA_PATH = `${import.meta.env?.BASE_URL ?? "/"}blocklab/media/`;

let current = DEFAULT_BLOCKLY_MEDIA_PATH;

/** 끝에 "/" 를 붙여 둔다 (Blockly 는 경로 뒤에 파일 이름을 바로 잇는다). 빈 값·undefined 는 기본값으로 */
export function setBlocklyMediaPath(path?: string | null): void {
  current = path ? (path.endsWith("/") ? path : `${path}/`) : DEFAULT_BLOCKLY_MEDIA_PATH;
}

/** Blockly.inject({ media }) 에 넘길 지금 경로 */
export function blocklyMediaPath(): string {
  return current;
}
