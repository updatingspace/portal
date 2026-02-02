import { setRef } from "./setRef.js";
export function mergeRefs(...refs) {
    return function mergedRefs(value) {
        for (const ref of refs) {
            setRef(ref, value);
        }
    };
}
//# sourceMappingURL=mergeRefs.js.map
