'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dialog = Dialog;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const React = tslib_1.__importStar(require("react"));
const Modal_1 = require("../Modal/index.js");
const cn_1 = require("../utils/cn.js");
const filterDOMProps_1 = require("../utils/filterDOMProps.js");
const ButtonClose_1 = require("./ButtonClose/ButtonClose.js");
const DialogBody_1 = require("./DialogBody/DialogBody.js");
const DialogDivider_1 = require("./DialogDivider/DialogDivider.js");
const DialogFooter_1 = require("./DialogFooter/DialogFooter.js");
const DialogHeader_1 = require("./DialogHeader/DialogHeader.js");
const DialogPrivateContext_1 = require("./DialogPrivateContext.js");
require("./Dialog.css");
const b = (0, cn_1.block)('dialog');
function Dialog({ container, children, open, disableBodyScrollLock = false, disableEscapeKeyDown = false, disableOutsideClick = false, initialFocus, returnFocus, keepMounted = false, size, contentOverflow = 'visible', className, modalClassName, hasCloseButton = true, disableHeightTransition = false, onEscapeKeyDown, onEnterKeyDown, onOpenChange, onOutsideClick, onClose, onTransitionIn, onTransitionInComplete, onTransitionOut, onTransitionOutComplete, qa, ...restProps }) {
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
    return ((0, jsx_runtime_1.jsx)(Modal_1.Modal, { ...(0, filterDOMProps_1.filterDOMProps)(restProps, { labelable: true }), open: open, contentOverflow: contentOverflow, disableBodyScrollLock: disableBodyScrollLock, disableEscapeKeyDown: disableEscapeKeyDown, disableOutsideClick: disableOutsideClick, disableVisuallyHiddenDismiss: hasCloseButton, initialFocus: initialFocusValue, returnFocus: returnFocus, keepMounted: keepMounted, onEscapeKeyDown: onEscapeKeyDown, onOutsideClick: onOutsideClick, onClose: onClose, onEnterKeyDown: onEnterKeyDown, onTransitionIn: onTransitionIn, onTransitionInComplete: onTransitionInComplete, onTransitionOut: onTransitionOut, onTransitionOutComplete: onTransitionOutComplete, className: b('modal', modalClassName), container: container, qa: qa, disableHeightTransition: true, children: (0, jsx_runtime_1.jsxs)("div", { className: b({
                size,
                'has-close': hasCloseButton,
                'has-scroll': contentOverflow === 'auto',
            }, className), children: [(0, jsx_runtime_1.jsx)(DialogPrivateContext_1.DialogPrivateContext.Provider, { value: privateContextProps, children: children }), hasCloseButton && (0, jsx_runtime_1.jsx)(ButtonClose_1.ButtonClose, { onClose: handleCloseButtonClick })] }) }));
}
Dialog.Footer = DialogFooter_1.DialogFooter;
Dialog.Header = DialogHeader_1.DialogHeader;
Dialog.Body = DialogBody_1.DialogBody;
Dialog.Divider = DialogDivider_1.DialogDivider;
//# sourceMappingURL=Dialog.js.map
