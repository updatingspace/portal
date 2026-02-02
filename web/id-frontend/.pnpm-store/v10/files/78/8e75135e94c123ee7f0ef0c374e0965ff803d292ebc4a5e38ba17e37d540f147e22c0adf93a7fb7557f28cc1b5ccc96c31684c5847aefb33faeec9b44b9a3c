'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabList = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const React = tslib_1.__importStar(require("react"));
const hooks_1 = require("../../hooks/index.js");
const TabContext_1 = require("./contexts/TabContext.js");
const useTabList_1 = require("./hooks/useTabList.js");
require("./TabList.css");
exports.TabList = React.forwardRef((props, ref) => {
    const tabContext = React.useContext(TabContext_1.TabContext);
    const id = (0, hooks_1.useUniqId)();
    const tabListProps = (0, useTabList_1.useTabList)(props);
    const [isFocused, setIsFocused] = React.useState(false);
    const { focusWithinProps } = (0, hooks_1.useFocusWithin)({
        onFocusWithinChange: setIsFocused,
    });
    const innerContextValue = React.useMemo(() => ({
        value: tabContext?.value ?? props.value,
        onUpdate: tabContext?.onUpdate ?? props.onUpdate,
        id: tabContext?.id ?? id,
        isProvider: tabContext?.isProvider ?? false,
        isFocused,
    }), [tabContext, props.value, props.onUpdate, id, isFocused]);
    return ((0, jsx_runtime_1.jsx)(TabContext_1.TabContext.Provider, { value: innerContextValue, children: (0, jsx_runtime_1.jsx)("div", { ref: ref, ...tabListProps, ...focusWithinProps, children: props.children }) }));
});
exports.TabList.displayName = 'TabList';
//# sourceMappingURL=TabList.js.map
