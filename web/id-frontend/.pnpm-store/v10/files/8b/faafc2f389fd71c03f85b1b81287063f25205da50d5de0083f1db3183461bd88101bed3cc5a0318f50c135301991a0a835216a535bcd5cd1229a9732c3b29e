'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { Flex } from "../layout/index.js";
import { AlertAction } from "./AlertAction.js";
import { bAlert } from "./constants.js";
import { useAlertContext } from "./useAlertContext.js";
export const AlertActions = ({ items, children, className }) => {
    const { layout } = useAlertContext();
    return (_jsx(Flex, { className: bAlert('actions', { minContent: layout === 'horizontal' }, className), direction: "row", gap: "3", wrap: true, alignItems: layout === 'horizontal' ? 'center' : 'flex-start', children: items?.map(({ handler, text }, i) => (_jsx(AlertAction, { onClick: handler, children: text }, i))) || children }));
};
//# sourceMappingURL=AlertActions.js.map
