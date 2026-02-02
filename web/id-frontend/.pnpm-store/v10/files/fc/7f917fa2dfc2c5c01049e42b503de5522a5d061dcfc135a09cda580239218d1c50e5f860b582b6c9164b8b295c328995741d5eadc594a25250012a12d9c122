'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationPage = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const Button_1 = require("../../../Button/index.js");
const cn_1 = require("../../../utils/cn.js");
const constants_1 = require("../../constants.js");
require("./PaginationPage.css");
const b = (0, cn_1.block)('pagination-page');
const PaginationPage = ({ item, size, pageSize, className, onUpdate }) => {
    const qa = (0, constants_1.getPaginationPageQa)(item.page);
    if (item.simple) {
        return ((0, jsx_runtime_1.jsx)("div", { "data-qa": qa, className: b('simple', { size }, className), children: item.page }));
    }
    const view = item.current ? 'normal' : 'flat';
    return ((0, jsx_runtime_1.jsx)(Button_1.Button, { size: size, view: view, selected: item.current, className: className, onClick: () => onUpdate(item.page, pageSize), qa: qa, children: item.page }, view));
};
exports.PaginationPage = PaginationPage;
//# sourceMappingURL=PaginationPage.js.map
