'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { Button } from "../../../Button/index.js";
import { block } from "../../../utils/cn.js";
import { getPaginationPageQa } from "../../constants.js";
import "./PaginationPage.css";
const b = block('pagination-page');
export const PaginationPage = ({ item, size, pageSize, className, onUpdate }) => {
    const qa = getPaginationPageQa(item.page);
    if (item.simple) {
        return (_jsx("div", { "data-qa": qa, className: b('simple', { size }, className), children: item.page }));
    }
    const view = item.current ? 'normal' : 'flat';
    return (_jsx(Button, { size: size, view: view, selected: item.current, className: className, onClick: () => onUpdate(item.page, pageSize), qa: qa, children: item.page }, view));
};
//# sourceMappingURL=PaginationPage.js.map
