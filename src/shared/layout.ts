/** Min/max width (px) of the resizable chat column. */
export const CHAT_WIDTH_MIN = 320
export const CHAT_WIDTH_MAX = 900
/** Default chat column width on first run. */
export const CHAT_WIDTH_DEFAULT = 420

/**
 * Width the chat column should take while dragging the splitter: the distance
 * from the cursor to the window's right edge, clamped to the allowed range.
 */
export function chatWidthFromPointer(innerWidth: number, clientX: number): number {
  return Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, innerWidth - clientX))
}
