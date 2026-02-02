"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Alert = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const icons_1 = require("@gravity-ui/icons");
const Button_1 = require("../Button/index.js");
const Card_1 = require("../Card/index.js");
const Icon_1 = require("../Icon/index.js");
const Text_1 = require("../Text/index.js");
const layout_1 = require("../layout/index.js");
const AlertAction_1 = require("./AlertAction.js");
const AlertActions_1 = require("./AlertActions.js");
const AlertContextProvider_1 = require("./AlertContextProvider.js");
const AlertIcon_1 = require("./AlertIcon.js");
const AlertTitle_1 = require("./AlertTitle.js");
const constants_1 = require("./constants.js");
const i18n_1 = tslib_1.__importDefault(require("./i18n/index.js"));
const Alert = (props) => {
    const { theme = 'normal', view = 'filled', layout = 'vertical', message, className, corners, style, onClose, align, qa, } = props;
    const commonProps = {
        style,
        className: (0, constants_1.bAlert)({ corners }, (0, layout_1.spacing)({ py: 4, px: 5 }, className)),
        qa,
    };
    const { t } = i18n_1.default.useTranslation();
    const content = ((0, jsx_runtime_1.jsxs)(layout_1.Flex, { gap: "3", alignItems: align, children: [typeof props.icon === 'undefined' ? ((0, jsx_runtime_1.jsx)(exports.Alert.Icon, { theme: theme, view: view })) : (props.icon // ability to pass `null` as `icon` prop value
            ), (0, jsx_runtime_1.jsxs)(layout_1.Flex, { direction: layout === 'vertical' ? 'column' : 'row', gap: "5", grow: true, children: [(0, jsx_runtime_1.jsx)(layout_1.Flex, { gap: "2", grow: true, className: (0, constants_1.bAlert)('text-content'), children: (0, jsx_runtime_1.jsxs)(layout_1.Flex, { direction: "column", gap: "1", grow: true, justifyContent: align, children: [typeof props.title === 'string' ? ((0, jsx_runtime_1.jsx)(exports.Alert.Title, { text: props.title })) : (props.title), message] }) }), Array.isArray(props.actions) ? ((0, jsx_runtime_1.jsx)(exports.Alert.Actions, { items: props.actions })) : (props.actions)] }), onClose && ((0, jsx_runtime_1.jsx)(Button_1.Button, { view: "flat", className: (0, constants_1.bAlert)('close-btn'), onClick: onClose, "aria-label": t('label_close'), children: (0, jsx_runtime_1.jsx)(Icon_1.Icon, { data: icons_1.Xmark, size: constants_1.DEFAULT_ICON_SIZE, className: (0, Text_1.colorText)({ color: 'secondary' }) }) }))] }));
    return ((0, jsx_runtime_1.jsx)(AlertContextProvider_1.AlertContextProvider, { layout: layout, view: view, children: theme === 'clear' ? ((0, jsx_runtime_1.jsx)("div", { ...commonProps, children: content })) : ((0, jsx_runtime_1.jsx)(Card_1.Card, { ...commonProps, theme: theme, view: view, children: content })) }));
};
exports.Alert = Alert;
exports.Alert.Icon = AlertIcon_1.AlertIcon;
exports.Alert.Title = AlertTitle_1.AlertTitle;
exports.Alert.Actions = AlertActions_1.AlertActions;
exports.Alert.Action = AlertAction_1.AlertAction;
//# sourceMappingURL=Alert.js.map
