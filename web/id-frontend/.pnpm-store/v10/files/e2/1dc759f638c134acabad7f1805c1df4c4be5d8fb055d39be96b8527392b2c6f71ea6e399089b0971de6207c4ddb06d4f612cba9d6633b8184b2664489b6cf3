'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { useUniqId } from "../../hooks/index.js";
import { TabContext } from "./contexts/TabContext.js";
export const TabProvider = ({ value, onUpdate, children }) => {
    const id = useUniqId();
    const contextValue = React.useMemo(() => ({ value, onUpdate, id, isProvider: true }), [value, onUpdate, id]);
    return _jsx(TabContext.Provider, { value: contextValue, children: children });
};
//# sourceMappingURL=TabProvider.js.map
