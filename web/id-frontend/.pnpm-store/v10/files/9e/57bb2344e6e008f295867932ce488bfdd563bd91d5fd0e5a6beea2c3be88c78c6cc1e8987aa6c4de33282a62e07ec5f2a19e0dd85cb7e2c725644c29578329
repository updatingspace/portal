'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { Label } from "../Label/index.js";
import { bTab } from "./constants.js";
import { useTab } from "./hooks/useTab.js";
import { isTabComponentProps, isTabLinkProps } from "./utils.js";
import "./Tab.css";
export const Tab = React.forwardRef(function Tab(props, ref) {
    const tabProps = useTab(props);
    const content = (_jsxs("div", { className: bTab('content'), children: [props.icon && _jsx("div", { className: bTab('icon'), children: props.icon }), _jsx("div", { className: bTab('title'), children: props.children || props.value }), props.counter !== undefined && _jsx("div", { className: bTab('counter'), children: props.counter }), props.label && (_jsx(Label, { className: bTab('label'), theme: props.label.theme, children: props.label.content }))] }));
    if (isTabComponentProps(props)) {
        return React.createElement(props.component, { ...tabProps, ref });
    }
    if (isTabLinkProps(props)) {
        return (_jsx("a", { ...tabProps, ref: ref, href: props.href, rel: props.target === '_blank' && !props.rel ? 'noopener noreferrer' : props.rel, children: content }));
    }
    return (_jsx("button", { ...tabProps, ref: ref, type: props.type || 'button', children: content }));
});
Tab.displayName = 'Tab';
//# sourceMappingURL=Tab.js.map
