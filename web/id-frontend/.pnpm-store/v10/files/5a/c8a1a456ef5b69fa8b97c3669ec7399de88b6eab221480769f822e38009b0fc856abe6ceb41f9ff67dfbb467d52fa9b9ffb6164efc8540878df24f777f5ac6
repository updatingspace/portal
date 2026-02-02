'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { useFocusWithin, useUniqId } from "../../hooks/index.js";
import { TabContext } from "./contexts/TabContext.js";
import { useTabList } from "./hooks/useTabList.js";
import "./TabList.css";
export const TabList = React.forwardRef((props, ref) => {
    const tabContext = React.useContext(TabContext);
    const id = useUniqId();
    const tabListProps = useTabList(props);
    const [isFocused, setIsFocused] = React.useState(false);
    const { focusWithinProps } = useFocusWithin({
        onFocusWithinChange: setIsFocused,
    });
    const innerContextValue = React.useMemo(() => ({
        value: tabContext?.value ?? props.value,
        onUpdate: tabContext?.onUpdate ?? props.onUpdate,
        id: tabContext?.id ?? id,
        isProvider: tabContext?.isProvider ?? false,
        isFocused,
    }), [tabContext, props.value, props.onUpdate, id, isFocused]);
    return (_jsx(TabContext.Provider, { value: innerContextValue, children: _jsx("div", { ref: ref, ...tabListProps, ...focusWithinProps, children: props.children }) }));
});
TabList.displayName = 'TabList';
//# sourceMappingURL=TabList.js.map
