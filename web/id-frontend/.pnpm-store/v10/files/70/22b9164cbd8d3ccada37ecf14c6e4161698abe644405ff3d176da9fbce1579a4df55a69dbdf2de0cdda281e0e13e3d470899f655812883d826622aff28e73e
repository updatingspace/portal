"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warnOnce = warnOnce;
const didWarn = new Map();
function warnOnce(msg) {
    if (!msg || didWarn.has(msg) || process.env.NODE_ENV === 'production') {
        return;
    }
    console.error(msg);
    didWarn.set(msg, true);
}
//# sourceMappingURL=warn.js.map
