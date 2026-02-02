import * as React from 'react';
import type { MobileContextProps } from "../mobile/index.js";
import "./Sheet.css";
interface SheetContentBaseProps {
    hideSheet: () => void;
    content: React.ReactNode;
    visible: boolean;
    id?: string;
    title?: string;
    contentClassName?: string;
    swipeAreaClassName?: string;
    hideTopBar?: boolean;
    maxContentHeightCoefficient?: number;
    alwaysFullHeight?: boolean;
}
interface SheetContentDefaultProps {
    id: string;
    allowHideOnContentScroll: boolean;
}
export declare const SheetContentContainer: React.ComponentType<Omit<MobileContextProps & SheetContentBaseProps & Partial<SheetContentDefaultProps>, keyof import("../mobile/index.js").WithMobileProps>>;
export {};
