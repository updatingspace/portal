'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { ActionTooltip } from "../ActionTooltip/index.js";
import { Button } from "../Button/index.js";
import { ClipboardIcon } from "../ClipboardIcon/index.js";
import { CopyToClipboard } from "../CopyToClipboard/index.js";
import { block } from "../utils/cn.js";
import i18n from "./i18n/index.js";
import "./ClipboardButton.css";
const b = block('clipboard-button');
const DEFAULT_TIMEOUT = 1200;
const ButtonSizeToIconSize = { xs: 12, s: 16, m: 16, l: 16, xl: 20 };
const ClipboardButtonComponent = (props) => {
    const { t } = i18n.useTranslation();
    const { size = 'm', hasTooltip = true, tooltipInitialText = t('startCopy'), tooltipSuccessText = t('endCopy'), status, view = 'flat', children, iconPosition = 'start', closeDelay, icon, ...rest } = props;
    const buttonIcon = (_jsx(Button.Icon, { className: b('icon'), children: icon ?? _jsx(ClipboardIcon, { size: ButtonSizeToIconSize[size], status: status }) }));
    return (_jsx(ActionTooltip, { title: status === 'success' ? tooltipSuccessText : tooltipInitialText, disabled: !hasTooltip, closeDelay: closeDelay, children: _jsxs(Button, { view: view, size: size, "aria-label": tooltipInitialText, ...rest, children: [iconPosition === 'start' ? buttonIcon : null, children, iconPosition === 'end' ? buttonIcon : null] }) }));
};
export function ClipboardButton(props) {
    const { text, timeout = DEFAULT_TIMEOUT, onCopy, hasTooltip = true, onMouseEnter, onFocus, ...buttonProps } = props;
    const timerIdRef = React.useRef();
    const [tooltipCloseDelay, setTooltipCloseDelay] = React.useState(undefined);
    const [tooltipDisabled, setTooltipDisabled] = React.useState(false);
    React.useEffect(() => window.clearTimeout(timerIdRef.current), []);
    const handleCopy = React.useCallback((text, result) => {
        onCopy?.(text, result);
        setTooltipDisabled(false);
        setTooltipCloseDelay(timeout);
        window.clearTimeout(timerIdRef.current);
        timerIdRef.current = window.setTimeout(() => {
            setTooltipDisabled(true);
        }, timeout);
    }, [onCopy, timeout]);
    const resetTooltip = React.useCallback(() => {
        if (tooltipDisabled) {
            setTooltipDisabled(false);
            setTooltipCloseDelay(undefined);
        }
    }, [tooltipDisabled]);
    const handleMouseEnter = React.useCallback((event) => {
        onMouseEnter?.(event);
        resetTooltip();
    }, [onMouseEnter, resetTooltip]);
    const handleFocus = React.useCallback((event) => {
        onFocus?.(event);
        resetTooltip();
    }, [onFocus, resetTooltip]);
    return (_jsx(CopyToClipboard, { text: text, timeout: timeout, onCopy: handleCopy, children: (status) => (_jsx(ClipboardButtonComponent, { ...buttonProps, closeDelay: tooltipCloseDelay, hasTooltip: hasTooltip && !tooltipDisabled, status: status, onMouseEnter: handleMouseEnter, onFocus: handleFocus })) }));
}
//# sourceMappingURL=ClipboardButton.js.map
