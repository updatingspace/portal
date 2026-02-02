"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeRefs = mergeRefs;
const setRef_1 = require("./setRef.js");
function mergeRefs(...refs) {
    return function mergedRefs(value) {
        for (const ref of refs) {
            (0, setRef_1.setRef)(ref, value);
        }
    };
}
//# sourceMappingURL=mergeRefs.js.map
