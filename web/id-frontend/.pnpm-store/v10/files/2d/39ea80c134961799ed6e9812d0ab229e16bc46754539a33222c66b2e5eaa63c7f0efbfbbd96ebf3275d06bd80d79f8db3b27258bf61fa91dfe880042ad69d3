import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Xmark } from '@gravity-ui/icons';
import { Button } from "../Button/index.js";
import { Card } from "../Card/index.js";
import { Icon } from "../Icon/index.js";
import { colorText } from "../Text/index.js";
import { Flex, spacing } from "../layout/index.js";
import { AlertAction } from "./AlertAction.js";
import { AlertActions } from "./AlertActions.js";
import { AlertContextProvider } from "./AlertContextProvider.js";
import { AlertIcon } from "./AlertIcon.js";
import { AlertTitle } from "./AlertTitle.js";
import { DEFAULT_ICON_SIZE, bAlert } from "./constants.js";
import i18n from "./i18n/index.js";
export const Alert = (props) => {
    const { theme = 'normal', view = 'filled', layout = 'vertical', message, className, corners, style, onClose, align, qa, } = props;
    const commonProps = {
        style,
        className: bAlert({ corners }, spacing({ py: 4, px: 5 }, className)),
        qa,
    };
    const { t } = i18n.useTranslation();
    const content = (_jsxs(Flex, { gap: "3", alignItems: align, children: [typeof props.icon === 'undefined' ? (_jsx(Alert.Icon, { theme: theme, view: view })) : (props.icon // ability to pass `null` as `icon` prop value
            ), _jsxs(Flex, { direction: layout === 'vertical' ? 'column' : 'row', gap: "5", grow: true, children: [_jsx(Flex, { gap: "2", grow: true, className: bAlert('text-content'), children: _jsxs(Flex, { direction: "column", gap: "1", grow: true, justifyContent: align, children: [typeof props.title === 'string' ? (_jsx(Alert.Title, { text: props.title })) : (props.title), message] }) }), Array.isArray(props.actions) ? (_jsx(Alert.Actions, { items: props.actions })) : (props.actions)] }), onClose && (_jsx(Button, { view: "flat", className: bAlert('close-btn'), onClick: onClose, "aria-label": t('label_close'), children: _jsx(Icon, { data: Xmark, size: DEFAULT_ICON_SIZE, className: colorText({ color: 'secondary' }) }) }))] }));
    return (_jsx(AlertContextProvider, { layout: layout, view: view, children: theme === 'clear' ? (_jsx("div", { ...commonProps, children: content })) : (_jsx(Card, { ...commonProps, theme: theme, view: view, children: content })) }));
};
Alert.Icon = AlertIcon;
Alert.Title = AlertTitle;
Alert.Actions = AlertActions;
Alert.Action = AlertAction;
//# sourceMappingURL=Alert.js.map
