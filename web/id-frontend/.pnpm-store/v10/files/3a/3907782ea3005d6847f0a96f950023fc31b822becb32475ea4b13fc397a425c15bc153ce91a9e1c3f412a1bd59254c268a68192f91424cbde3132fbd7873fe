import * as React from 'react';
import type { MenuItemButtonProps, MenuItemComponentElementType, MenuItemComponentProps, MenuItemLinkProps, MenuItemProps } from "./types.js";
import "./MenuItem.css";
export declare const MenuItem: (<T extends MenuItemComponentElementType, P extends MenuItemProps<T>>(props: P extends {
    component: Exclude<T, undefined>;
} ? MenuItemComponentProps<Exclude<T, undefined>> & {
    ref?: React.Ref<T extends string ? React.ComponentRef<T> : T>;
} : P extends {
    href: string;
} ? MenuItemLinkProps & {
    ref?: React.Ref<HTMLAnchorElement>;
} : MenuItemButtonProps & {
    ref?: React.Ref<HTMLButtonElement>;
}) => React.ReactElement) & {
    displayName?: string;
};
