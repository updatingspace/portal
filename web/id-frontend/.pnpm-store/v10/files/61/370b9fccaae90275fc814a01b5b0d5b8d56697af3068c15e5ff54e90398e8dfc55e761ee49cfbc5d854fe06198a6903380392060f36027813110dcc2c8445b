'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tab = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const React = tslib_1.__importStar(require("react"));
const Label_1 = require("../Label/index.js");
const constants_1 = require("./constants.js");
const useTab_1 = require("./hooks/useTab.js");
const utils_1 = require("./utils.js");
require("./Tab.css");
exports.Tab = React.forwardRef(function Tab(props, ref) {
    const tabProps = (0, useTab_1.useTab)(props);
    const content = ((0, jsx_runtime_1.jsxs)("div", { className: (0, constants_1.bTab)('content'), children: [props.icon && (0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.bTab)('icon'), children: props.icon }), (0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.bTab)('title'), children: props.children || props.value }), props.counter !== undefined && (0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.bTab)('counter'), children: props.counter }), props.label && ((0, jsx_runtime_1.jsx)(Label_1.Label, { className: (0, constants_1.bTab)('label'), theme: props.label.theme, children: props.label.content }))] }));
    if ((0, utils_1.isTabComponentProps)(props)) {
        return React.createElement(props.component, { ...tabProps, ref });
    }
    if ((0, utils_1.isTabLinkProps)(props)) {
        return ((0, jsx_runtime_1.jsx)("a", { ...tabProps, ref: ref, href: props.href, rel: props.target === '_blank' && !props.rel ? 'noopener noreferrer' : props.rel, children: content }));
    }
    return ((0, jsx_runtime_1.jsx)("button", { ...tabProps, ref: ref, type: props.type || 'button', children: content }));
});
exports.Tab.displayName = 'Tab';
//# sourceMappingURL=Tab.js.map
