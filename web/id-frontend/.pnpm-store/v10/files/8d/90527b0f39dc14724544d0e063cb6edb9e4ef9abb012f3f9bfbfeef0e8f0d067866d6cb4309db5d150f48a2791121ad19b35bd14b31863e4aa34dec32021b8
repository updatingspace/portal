'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertActions = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const layout_1 = require("../layout/index.js");
const AlertAction_1 = require("./AlertAction.js");
const constants_1 = require("./constants.js");
const useAlertContext_1 = require("./useAlertContext.js");
const AlertActions = ({ items, children, className }) => {
    const { layout } = (0, useAlertContext_1.useAlertContext)();
    return ((0, jsx_runtime_1.jsx)(layout_1.Flex, { className: (0, constants_1.bAlert)('actions', { minContent: layout === 'horizontal' }, className), direction: "row", gap: "3", wrap: true, alignItems: layout === 'horizontal' ? 'center' : 'flex-start', children: items?.map(({ handler, text }, i) => ((0, jsx_runtime_1.jsx)(AlertAction_1.AlertAction, { onClick: handler, children: text }, i))) || children }));
};
exports.AlertActions = AlertActions;
//# sourceMappingURL=AlertActions.js.map
