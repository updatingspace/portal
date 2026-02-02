export function setRef(ref, value) {
    if (typeof ref === 'function') {
        ref(value);
    }
    else if (ref) {
        //@ts-expect-error
        ref.current = value;
    }
}
//# sourceMappingURL=setRef.js.map
