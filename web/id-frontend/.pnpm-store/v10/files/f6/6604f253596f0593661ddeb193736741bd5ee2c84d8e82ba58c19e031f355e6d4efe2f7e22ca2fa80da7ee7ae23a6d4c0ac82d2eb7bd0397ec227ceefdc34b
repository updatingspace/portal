import * as React from 'react';
import type { ModalCloseReason, ModalProps } from "../Modal/index.js";
import type { AriaLabelingProps, QAProps } from "../types.js";
import { DialogBody } from "./DialogBody/DialogBody.js";
import { DialogDivider } from "./DialogDivider/DialogDivider.js";
import { DialogFooter } from "./DialogFooter/DialogFooter.js";
import { DialogHeader } from "./DialogHeader/DialogHeader.js";
import "./Dialog.css";
export interface DialogProps extends AriaLabelingProps, QAProps {
    open: boolean;
    children: React.ReactNode;
    onOpenChange?: ModalProps['onOpenChange'];
    onEnterKeyDown?: (event: KeyboardEvent) => void;
    onEscapeKeyDown?: ModalProps['onEscapeKeyDown'];
    onOutsideClick?: ModalProps['onOutsideClick'];
    onClose: (event: MouseEvent | KeyboardEvent, reason: ModalCloseReason | 'closeButtonClick') => void;
    onTransitionIn?: ModalProps['onTransitionIn'];
    onTransitionInComplete?: ModalProps['onTransitionInComplete'];
    onTransitionOut?: ModalProps['onTransitionOut'];
    onTransitionOutComplete?: ModalProps['onTransitionOutComplete'];
    className?: string;
    modalClassName?: string;
    size?: 's' | 'm' | 'l';
    container?: HTMLElement;
    initialFocus?: ModalProps['initialFocus'] | 'cancel' | 'apply';
    returnFocus?: ModalProps['returnFocus'];
    contentOverflow?: 'visible' | 'auto';
    disableBodyScrollLock?: boolean;
    disableEscapeKeyDown?: boolean;
    disableOutsideClick?: boolean;
    keepMounted?: boolean;
    hasCloseButton?: boolean;
    disableHeightTransition?: boolean;
}
export declare function Dialog({ container, children, open, disableBodyScrollLock, disableEscapeKeyDown, disableOutsideClick, initialFocus, returnFocus, keepMounted, size, contentOverflow, className, modalClassName, hasCloseButton, disableHeightTransition, onEscapeKeyDown, onEnterKeyDown, onOpenChange, onOutsideClick, onClose, onTransitionIn, onTransitionInComplete, onTransitionOut, onTransitionOutComplete, qa, ...restProps }: DialogProps): import("react/jsx-runtime").JSX.Element;
export declare namespace Dialog {
    var Footer: typeof DialogFooter;
    var Header: typeof DialogHeader;
    var Body: typeof DialogBody;
    var Divider: typeof DialogDivider;
}
