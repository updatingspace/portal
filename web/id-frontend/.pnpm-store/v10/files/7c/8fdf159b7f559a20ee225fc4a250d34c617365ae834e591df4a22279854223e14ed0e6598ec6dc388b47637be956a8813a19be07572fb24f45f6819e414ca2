'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { block } from "../utils/cn.js";
import { filterDOMProps } from "../utils/filterDOMProps.js";
import { MenuGroup } from "./MenuGroup.js";
import { MenuItem } from "./MenuItem.js";
import "./Menu.css";
const b = block('menu');
// TODO: keyboard navigation, Up/Down arrows and Enter
export const Menu = React.forwardRef(function Menu({ size = 'm', children, style, className, qa, ...restProps }, ref) {
    return (_jsx("ul", { ...filterDOMProps(restProps, { labelable: true }), ref: ref, role: "menu", 
        // tabIndex={0}
        style: style, className: b({ size }, className), "data-qa": qa, children: children }));
});
Menu.Item = MenuItem;
Menu.Group = MenuGroup;
//# sourceMappingURL=Menu.js.map
