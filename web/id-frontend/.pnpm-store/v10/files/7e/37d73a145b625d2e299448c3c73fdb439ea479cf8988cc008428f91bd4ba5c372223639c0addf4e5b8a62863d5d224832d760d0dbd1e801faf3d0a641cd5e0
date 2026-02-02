import * as React from 'react';
import type { PopupProps } from "../Popup/index.js";
import type { AriaLabelingProps, DOMProps, QAProps } from "../types.js";
export interface PopoverProps extends AriaLabelingProps, QAProps, DOMProps, Pick<PopupProps, 'container' | 'disablePortal' | 'open' | 'onOpenChange' | 'strategy' | 'placement' | 'offset' | 'keepMounted' | 'hasArrow' | 'modal' | 'initialFocus' | 'returnFocus' | 'disableVisuallyHiddenDismiss' | 'zIndex'> {
    children: ((props: Record<string, unknown>, ref: React.Ref<HTMLElement>) => React.ReactElement) | React.ReactElement;
    disabled?: boolean;
    content?: React.ReactNode;
    trigger?: 'click';
    openDelay?: number;
    closeDelay?: number;
    enableSafePolygon?: boolean;
}
export declare function Popover({ children, open, onOpenChange, disabled, content, trigger, openDelay, closeDelay, enableSafePolygon, className, ...restProps }: PopoverProps): import("react/jsx-runtime").JSX.Element;
