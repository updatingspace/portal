'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { Modal } from "../Modal/index.js";
import { block } from "../utils/cn.js";
import { filterDOMProps } from "../utils/filterDOMProps.js";
import { ButtonClose } from "./ButtonClose/ButtonClose.js";
import { DialogBody } from "./DialogBody/DialogBody.js";
import { DialogDivider } from "./DialogDivider/DialogDivider.js";
import { DialogFooter } from "./DialogFooter/DialogFooter.js";
import { DialogHeader } from "./DialogHeader/DialogHeader.js";
import { DialogPrivateContext } from "./DialogPrivateContext.js";
import "./Dialog.css";
const b = block('dialog');
export function Dialog({ container, children, open, disableBodyScrollLock = false, disableEscapeKeyDown = false, disableOutsideClick = false, initialFocus, returnFocus, keepMounted = false, size, contentOverflow = 'visible', className, modalClassName, hasCloseButton = true, disableHeightTransition = false, onEscapeKeyDown, onEnterKeyDown, onOpenChange, onOutsideClick, onClose, onTransitionIn, onTransitionInComplete, onTransitionOut, onTransitionOutComplete, qa, ...restProps }) {
    const handleCloseButtonClick = React.useCallback((event) => {
        onClose(event.nativeEvent, 'closeButtonClick');
    }, [onClose]);
    const footerAutoFocusRef = React.useRef(null);
    const privateContextProps = React.useMemo(() => {
        const result = {
            onTooltipEscapeKeyDown: (event) => {
                onOpenChange?.(false, event, 'escape-key');
                onEscapeKeyDown?.(event);
                onClose?.(event, 'escapeKeyDown');
            },
            disableHeightTransition: disableHeightTransition || !open,
        };
        if (typeof initialFocus === 'string') {
            result.initialFocusRef = footerAutoFocusRef;
            result.initialFocusAction = initialFocus;
        }
        return result;
    }, [initialFocus, onEscapeKeyDown, onClose, onOpenChange, open, disableHeightTransition]);
    let initialFocusValue;
    if (typeof initialFocus === 'string') {
        initialFocusValue = footerAutoFocusRef;
    }
    else {
        initialFocusValue = initialFocus;
    }
    return (_jsx(Modal, { ...filterDOMProps(restProps, { labelable: true }), open: open, contentOverflow: contentOverflow, disableBodyScrollLock: disableBodyScrollLock, disableEscapeKeyDown: disableEscapeKeyDown, disableOutsideClick: disableOutsideClick, disableVisuallyHiddenDismiss: hasCloseButton, initialFocus: initialFocusValue, returnFocus: returnFocus, keepMounted: keepMounted, onEscapeKeyDown: onEscapeKeyDown, onOutsideClick: onOutsideClick, onClose: onClose, onEnterKeyDown: onEnterKeyDown, onTransitionIn: onTransitionIn, onTransitionInComplete: onTransitionInComplete, onTransitionOut: onTransitionOut, onTransitionOutComplete: onTransitionOutComplete, className: b('modal', modalClassName), container: container, qa: qa, disableHeightTransition: true, children: _jsxs("div", { className: b({
                size,
                'has-close': hasCloseButton,
                'has-scroll': contentOverflow === 'auto',
            }, className), children: [_jsx(DialogPrivateContext.Provider, { value: privateContextProps, children: children }), hasCloseButton && _jsx(ButtonClose, { onClose: handleCloseButtonClick })] }) }));
}
Dialog.Footer = DialogFooter;
Dialog.Header = DialogHeader;
Dialog.Body = DialogBody;
Dialog.Divider = DialogDivider;
//# sourceMappingURL=Dialog.js.map
