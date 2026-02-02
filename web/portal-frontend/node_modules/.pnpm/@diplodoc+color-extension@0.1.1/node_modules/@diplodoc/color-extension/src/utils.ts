import {ColorTokenChar} from './constants';

export function isEscaped(src: string, pos: number): boolean {
    // An escape is valid if it is preceded by an **odd** number of consecutive
    // backslashes. This handles cases like `\\(` where the first backslash
    // escapes the second, so the parenthesis is *not* escaped.
    let count = 0;
    let i = pos - 1;

    while (i >= 0 && src.charCodeAt(i) === ColorTokenChar.Escape) {
        count++;
        i--;
    }

    return count % 2 === 1;
}