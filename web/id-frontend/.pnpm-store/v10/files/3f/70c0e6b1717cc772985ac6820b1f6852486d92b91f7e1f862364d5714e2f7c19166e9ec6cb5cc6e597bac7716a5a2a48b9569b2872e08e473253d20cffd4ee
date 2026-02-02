'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { safePolygon, useClick, useDismiss, useFloatingRootContext, useHover, useInteractions, useRole, } from '@floating-ui/react';
import { useControlledState, useForkRef } from "../../hooks/index.js";
import { Popup } from "../Popup/index.js";
import { block } from "../utils/cn.js";
import { getElementRef } from "../utils/getElementRef.js";
const b = block('popover');
const DEFAULT_OPEN_DELAY = 500;
const DEFAULT_CLOSE_DELAY = 250;
export function Popover({ children, open, onOpenChange, disabled, content, trigger, openDelay = DEFAULT_OPEN_DELAY, closeDelay = DEFAULT_CLOSE_DELAY, enableSafePolygon, className, ...restProps }) {
    const [anchorElement, setAnchorElement] = React.useState(null);
    const [floatingElement, setFloatingElement] = React.useState(null);
    const [isOpen, setIsOpen] = useControlledState(open, false, onOpenChange);
    const context = useFloatingRootContext({
        open: isOpen && !disabled,
        onOpenChange: setIsOpen,
        elements: {
            reference: anchorElement,
            floating: floatingElement,
        },
    });
    const isHoverEnabled = trigger !== 'click';
    const hover = useHover(context, {
        enabled: isHoverEnabled,
        delay: { open: openDelay, close: closeDelay },
        move: false,
        handleClose: enableSafePolygon ? safePolygon() : undefined,
    });
    const click = useClick(context, {
        ignoreMouse: isHoverEnabled,
    });
    const role = useRole(context, {
        role: 'dialog',
    });
    const dismiss = useDismiss(context);
    const interactions = [hover, click, role, dismiss];
    const { getReferenceProps } = useInteractions(interactions);
    const anchorRef = useForkRef(setAnchorElement, React.isValidElement(children) ? getElementRef(children) : undefined);
    const anchorProps = React.isValidElement(children)
        ? getReferenceProps(children.props)
        : getReferenceProps();
    const anchorNode = React.isValidElement(children)
        ? React.cloneElement(children, {
            ...anchorProps,
            ref: anchorRef,
        })
        : children(anchorProps, anchorRef);
    return (_jsxs(React.Fragment, { children: [anchorNode, _jsx(Popup, { ...restProps, open: context.open, floatingContext: context, floatingRef: setFloatingElement, floatingInteractions: interactions, className: b(null, className), children: content })] }));
}
//# sourceMappingURL=Popover.js.map
