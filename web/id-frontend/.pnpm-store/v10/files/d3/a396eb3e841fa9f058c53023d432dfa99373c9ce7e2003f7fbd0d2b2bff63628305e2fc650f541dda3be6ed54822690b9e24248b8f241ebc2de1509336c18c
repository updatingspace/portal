import * as React from 'react';
import { MenuDivider } from "./MenuDivider.js";
import type { MenuProps } from "./types.js";
import "./Menu.css";
export declare function Menu({ trigger, inline, defaultOpen, open, onOpenChange, placement, disabled, children, size, className, style, qa, }: MenuProps): import("react/jsx-runtime").JSX.Element;
export declare namespace Menu {
    var displayName: string;
    var Trigger: React.ForwardRefExoticComponent<import("./MenuTrigger.js").MenuTriggerProps & React.RefAttributes<HTMLButtonElement>>;
    var Item: (<T extends import("./types.js").MenuItemComponentElementType, P extends import("./types.js").MenuItemProps<T>>(props: P extends {
        component: Exclude<T, undefined>;
    } ? import("./types.js").MenuItemComponentProps<Exclude<T, undefined>> & {
        ref?: React.Ref<T extends string ? React.ComponentRef<T> : T>;
    } : P extends {
        href: string;
    } ? import("./types.js").MenuItemLinkProps & {
        ref?: React.Ref<HTMLAnchorElement>;
    } : import("./types.js").MenuItemButtonProps & {
        ref?: React.Ref<HTMLButtonElement>;
    }) => React.ReactElement) & {
        displayName?: string;
    };
    var Divider: typeof MenuDivider;
}
