"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRef = setRef;
function setRef(ref, value) {
    if (typeof ref === 'function') {
        ref(value);
    }
    else if (ref) {
        //@ts-expect-error
        ref.current = value;
    }
}
//# sourceMappingURL=setRef.js.map
