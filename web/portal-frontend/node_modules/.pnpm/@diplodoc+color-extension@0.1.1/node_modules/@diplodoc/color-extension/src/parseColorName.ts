import StateInline from 'markdown-it/lib/rules_inline/state_inline'

import {ColorTokenChar} from './constants';
import {isEscaped} from './utils';

/**
 * If successful, returns end pos.
 * Else, returns -1
 */
export const parseColorName = (state: StateInline, start: number, disableNested: boolean, shouldEscape: boolean = false): number => {
  let level = 1
  let found = false
  let prevPos: number
  let labelEnd = -1
  const max = state.posMax
  const oldPos = state.pos

  state.pos = start + 1

  while (state.pos < max) {
    const marker = state.src.charCodeAt(state.pos)

    if (!(shouldEscape && isEscaped(state.src, state.pos)) && marker === ColorTokenChar.CloseColorName) {
      level--
      if (level === 0) {
        found = true
        break
      }
    }

    prevPos = state.pos
    state.md.inline.skipToken(state)

    if (!(shouldEscape && isEscaped(state.src, state.pos)) && marker === ColorTokenChar.OpenColorName) {
      if (prevPos === state.pos - 1) {
        // increase level if we find open bracket, which is not a part of any token
        level++
      } else if (disableNested) {
        state.pos = oldPos
        return -1
      }
    }
  }

  if (found) {
    labelEnd = state.pos
  }

  // restore old state
  state.pos = oldPos

  return labelEnd
}
