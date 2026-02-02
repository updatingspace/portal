const didWarn = new Map();
export function warnOnce(msg) {
    if (!msg || didWarn.has(msg) || process.env.NODE_ENV === 'production') {
        return;
    }
    console.error(msg);
    didWarn.set(msg, true);
}
//# sourceMappingURL=warn.js.map
