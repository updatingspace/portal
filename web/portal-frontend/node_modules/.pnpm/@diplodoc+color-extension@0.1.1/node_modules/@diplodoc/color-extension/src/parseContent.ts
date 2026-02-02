import StateInline from 'markdown-it/lib/rules_inline/state_inline'

import {ColorTokenChar} from './constants';
import {isEscaped} from './utils';

/**
 * If successful, returns end pos.
 * Else, returns -1
 */
export const parseContent = (state: StateInline, start: number, shouldEscape: boolean = false): number => {
  let pos = start
  const {posMax: max, src} = state

  if (pos >= max || src.charCodeAt(pos) !== ColorTokenChar.OpenContent) {
    return -1;
  }

  pos++
  let level = 1

  while (pos < max) {
    const char = src.charCodeAt(pos)

    if (shouldEscape && isEscaped(src, pos)) {
      pos++;
      continue;
    }

    if (char === ColorTokenChar.CloseContent) {
      level--;

      if (level === 0) {
        return pos;
      }
    } else if (char === ColorTokenChar.OpenContent) {
      level++;
    }

    pos++;
  }

  // if we failed to find "("
  return -1
}
