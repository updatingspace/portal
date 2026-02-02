import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { block } from "../utils/cn.js";
import { TocSections } from "./TocSections/index.js";
const b = block('toc');
export const Toc = React.forwardRef(function Toc(props, ref) {
    const { value: activeValue, items, className, onUpdate, qa, onItemClick } = props;
    return (_jsx("nav", { className: b(null, className), ref: ref, "data-qa": qa, children: _jsx(TocSections, { items: items, value: activeValue, onUpdate: onUpdate, depth: 1, onItemClick: onItemClick }) }));
});
//# sourceMappingURL=Toc.js.map
