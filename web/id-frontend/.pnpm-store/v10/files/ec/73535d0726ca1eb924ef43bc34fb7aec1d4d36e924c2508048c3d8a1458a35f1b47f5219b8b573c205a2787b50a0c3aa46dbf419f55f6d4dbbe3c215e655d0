'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationButton = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const icons_1 = require("@gravity-ui/icons");
const Button_1 = require("../../../Button/index.js");
const Icon_1 = require("../../../Icon/index.js");
const constants_1 = require("../../constants.js");
const i18n_1 = tslib_1.__importDefault(require("../../i18n/index.js"));
const PaginationButton = ({ item, size, className, page, pageSize, onUpdate, compact, }) => {
    let button = null;
    const { disabled } = item;
    const { t } = i18n_1.default.useTranslation();
    switch (item.action) {
        case 'first':
            button = ((0, jsx_runtime_1.jsxs)(Button_1.Button, { size: size, view: "outlined", className: className, onClick: () => onUpdate(1, pageSize), title: compact ? t('button_first') : undefined, disabled: disabled, qa: constants_1.PaginationQa.PaginationButtonFirst, children: [(0, jsx_runtime_1.jsx)(Icon_1.Icon, { data: icons_1.ChevronsLeft, size: "16" }), compact ? undefined : t('button_first')] }));
            break;
        case 'previous':
            button = ((0, jsx_runtime_1.jsxs)(Button_1.Button, { size: size, view: "outlined", className: className, onClick: () => onUpdate(page - 1, pageSize), title: compact ? t('button_previous') : undefined, disabled: disabled, qa: constants_1.PaginationQa.PaginationButtonPrevious, children: [(0, jsx_runtime_1.jsx)(Icon_1.Icon, { data: icons_1.ChevronLeft, size: "16" }), compact ? undefined : t('button_previous')] }));
            break;
        case 'next':
            button = ((0, jsx_runtime_1.jsxs)(Button_1.Button, { size: size, view: "outlined", className: className, onClick: () => onUpdate(page + 1, pageSize), title: compact ? t('button_next') : undefined, disabled: disabled, qa: constants_1.PaginationQa.PaginationButtonNext, children: [(0, jsx_runtime_1.jsx)(Icon_1.Icon, { data: icons_1.ChevronRight, size: "16" }), compact ? undefined : t('button_next')] }));
            break;
    }
    return button;
};
exports.PaginationButton = PaginationButton;
//# sourceMappingURL=PaginationButton.js.map
