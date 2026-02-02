'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Breadcrumbs = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const React = tslib_1.__importStar(require("react"));
const hooks_1 = require("../../hooks/index.js");
const filterDOMProps_1 = require("../utils/filterDOMProps.js");
const BreadcrumbsDropdownMenu_1 = require("./BreadcrumbsDropdownMenu.js");
const BreadcrumbsItem_1 = require("./BreadcrumbsItem.js");
const BreadcrumbsSeparator_1 = require("./BreadcrumbsSeparator.js");
const utils_1 = require("./utils.js");
require("./Breadcrumbs.css");
exports.Breadcrumbs = React.forwardRef(function Breadcrumbs(props, ref) {
    const listRef = React.useRef(null);
    const containerRef = (0, hooks_1.useForkRef)(ref, listRef);
    const endContentRef = React.useRef(null);
    const items = [];
    React.Children.forEach(props.children, (child, index) => {
        if (React.isValidElement(child)) {
            if (child.key === undefined || child.key === null) {
                child = React.cloneElement(child, { key: index });
            }
            items.push(child);
        }
    });
    const [visibleItemsCount, setVisibleItemsCount] = React.useState(items.length);
    const [calculated, setCalculated] = React.useState(false);
    const recalculate = (visibleItems) => {
        const list = listRef.current;
        if (!list) {
            return;
        }
        const listItems = Array.from(list.children);
        const endElement = endContentRef.current;
        if (endElement) {
            listItems.pop();
        }
        if (listItems.length === 0) {
            setCalculated(true);
            return;
        }
        const containerWidth = list.offsetWidth - (endElement?.offsetWidth ?? 0);
        let newVisibleItemsCount = 0;
        let calculatedWidth = 0;
        let maxItems = props.maxItems || Infinity;
        let rootWidth = 0;
        if (props.showRoot) {
            const item = listItems.shift();
            if (item) {
                rootWidth = item.offsetWidth;
                calculatedWidth += rootWidth;
            }
            newVisibleItemsCount++;
        }
        const hasMenu = items.length > visibleItems;
        if (hasMenu) {
            const item = listItems.shift();
            if (item) {
                calculatedWidth += item.offsetWidth;
            }
            maxItems--;
        }
        if (props.showRoot && calculatedWidth >= containerWidth) {
            calculatedWidth -= rootWidth;
            newVisibleItemsCount--;
        }
        const lastItem = listItems.pop();
        if (lastItem) {
            calculatedWidth += Math.min(lastItem.offsetWidth, 200);
            if (calculatedWidth < containerWidth) {
                newVisibleItemsCount++;
            }
        }
        for (let i = listItems.length - 1; i >= 0; i--) {
            const item = listItems[i];
            calculatedWidth += item.offsetWidth;
            if (calculatedWidth >= containerWidth) {
                break;
            }
            newVisibleItemsCount++;
        }
        newVisibleItemsCount = Math.max(Math.min(maxItems, newVisibleItemsCount), 1);
        if (newVisibleItemsCount === visibleItemsCount) {
            setCalculated(true);
        }
        else {
            setVisibleItemsCount(newVisibleItemsCount);
        }
    };
    const handleResize = React.useCallback(() => {
        setVisibleItemsCount(items.length);
        setCalculated(false);
    }, [items.length]);
    (0, hooks_1.useResizeObserver)({
        ref: listRef,
        onResize: handleResize,
    });
    (0, hooks_1.useResizeObserver)({
        ref: props.endContent ? endContentRef : undefined,
        onResize: handleResize,
    });
    const lastChildren = React.useRef(null);
    (0, hooks_1.useLayoutEffect)(() => {
        if (calculated && props.children !== lastChildren.current) {
            lastChildren.current = props.children;
            setVisibleItemsCount(items.length);
            setCalculated(false);
        }
    }, [calculated, items.length, props.children]);
    (0, hooks_1.useLayoutEffect)(() => {
        if (!calculated) {
            recalculate(visibleItemsCount);
        }
    });
    let contents = items;
    if (items.length > visibleItemsCount) {
        contents = [];
        const breadcrumbs = [...items];
        let endItems = visibleItemsCount;
        if (props.showRoot && visibleItemsCount > 1) {
            const rootItem = breadcrumbs.shift();
            if (rootItem) {
                contents.push(rootItem);
            }
            endItems--;
        }
        const hiddenItems = breadcrumbs.slice(0, -endItems);
        const menuItem = ((0, jsx_runtime_1.jsx)(BreadcrumbsDropdownMenu_1.BreadcrumbsDropdownMenu, { disabled: props.disabled, popupPlacement: props.popupPlacement, popupStyle: props.popupStyle, "data-breadcrumbs-menu-item": true, children: hiddenItems.map((child, index) => {
                const Component = props.itemComponent ?? BreadcrumbsItem_1.BreadcrumbsItem;
                const key = child.key ?? index;
                const handleAction = () => {
                    if (typeof props.onAction === 'function') {
                        props.onAction(key);
                    }
                };
                const innerProps = {
                    __index: index,
                    __disabled: props.disabled || child.props.disabled,
                    __onAction: handleAction,
                };
                return ((0, react_1.createElement)(Component, { ...child.props, key: key, ...innerProps }, child.props.children));
            }) }));
        contents.push(menuItem);
        contents.push(...breadcrumbs.slice(-endItems));
    }
    const lastIndex = contents.length - 1;
    const breadcrumbsItems = contents.map((child, index) => {
        const isCurrent = index === lastIndex;
        const key = child.key ?? index;
        const { 'data-breadcrumbs-menu-item': isMenu, ...childProps } = child.props;
        let item;
        if (isMenu) {
            item = child;
        }
        else {
            const Component = props.itemComponent ?? BreadcrumbsItem_1.BreadcrumbsItem;
            const handleAction = () => {
                if (typeof props.onAction === 'function') {
                    props.onAction(key);
                }
            };
            const innerProps = {
                __current: isCurrent,
                __disabled: props.disabled || childProps.disabled,
                __onAction: handleAction,
            };
            item = ((0, react_1.createElement)(Component, { ...childProps, key: key, ...innerProps }, childProps.children));
        }
        return ((0, jsx_runtime_1.jsxs)("li", { className: (0, utils_1.b)('item', { calculating: isCurrent && !calculated, current: isCurrent }), children: [item, isCurrent ? null : (0, jsx_runtime_1.jsx)(BreadcrumbsSeparator_1.BreadcrumbsSeparator, { separator: props.separator })] }, isMenu ? 'menu' : `item-${key}`));
    });
    if (props.endContent) {
        breadcrumbsItems.push((0, jsx_runtime_1.jsx)("li", { ref: endContentRef, className: (0, utils_1.b)('item'), children: props.endContent }, "end-content"));
    }
    return ((0, jsx_runtime_1.jsx)("ol", { ref: containerRef, ...(0, filterDOMProps_1.filterDOMProps)(props, { labelable: true }), "data-qa": props.qa, className: (0, utils_1.b)(null, props.className), style: props.style, children: breadcrumbsItems }));
});
exports.Breadcrumbs.Item = BreadcrumbsItem_1.BreadcrumbsItem;
exports.Breadcrumbs.displayName = 'Breadcrumbs';
//# sourceMappingURL=Breadcrumbs.js.map
