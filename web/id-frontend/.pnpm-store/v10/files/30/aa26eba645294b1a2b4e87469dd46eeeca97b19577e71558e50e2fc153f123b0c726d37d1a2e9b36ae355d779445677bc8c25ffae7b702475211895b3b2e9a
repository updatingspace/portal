import * as React from 'react';
import type { DOMProps, QAProps } from "../types.js";
import type { BUTTON_VIEWS } from "./constants.js";
import "./Button.css";
export type ButtonView = (typeof BUTTON_VIEWS)[number];
export type ButtonSize = 'xs' | 's' | 'm' | 'l' | 'xl';
export type ButtonPin = 'round-round' | 'brick-brick' | 'clear-clear' | 'circle-circle' | 'round-brick' | 'brick-round' | 'round-clear' | 'clear-round' | 'brick-clear' | 'clear-brick' | 'circle-brick' | 'brick-circle' | 'circle-clear' | 'clear-circle';
export type ButtonWidth = 'auto' | 'max';
interface ButtonCommonProps extends QAProps, DOMProps {
    view?: ButtonView;
    size?: ButtonSize;
    pin?: ButtonPin;
    selected?: boolean;
    disabled?: boolean;
    loading?: boolean;
    width?: ButtonWidth;
    children?: React.ReactNode;
}
export interface ButtonButtonProps extends ButtonCommonProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'style'> {
    component?: never;
    href?: never;
    /**
     * @deprecated Use additional props at the root
     */
    extraProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}
export interface ButtonLinkProps extends ButtonCommonProps, Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'style'> {
    component?: never;
    href: string;
    /**
     * @deprecated Use additional props at the root
     */
    extraProps?: React.AnchorHTMLAttributes<HTMLAnchorElement>;
}
export type ButtonComponentProps<T extends Exclude<ButtonCustomElementType, undefined>> = ButtonCommonProps & React.ComponentPropsWithoutRef<T> & {
    component: T;
    /**
     * @deprecated Use additional props at the root
     */
    extraProps?: React.ComponentPropsWithoutRef<T>;
};
export type ButtonCustomElementType = Exclude<React.ElementType, 'a' | 'button'> | undefined;
export type ButtonProps<T extends ButtonCustomElementType = undefined> = ButtonLinkProps | ButtonButtonProps | ButtonComponentProps<Exclude<T, undefined>>;
export declare const Button: (<T extends ButtonCustomElementType, P extends ButtonProps<T>>(props: P extends {
    component: Exclude<T, undefined>;
} ? ButtonComponentProps<Exclude<T, undefined>> & {
    ref?: React.Ref<T extends string ? React.ComponentRef<T> : T>;
} : P extends {
    href: string;
} ? ButtonLinkProps & {
    ref?: React.Ref<HTMLAnchorElement>;
} : ButtonButtonProps & {
    ref?: React.Ref<HTMLButtonElement>;
}) => React.ReactElement) & {
    Icon: {
        ({ side, className, children }: {
            className?: string;
            side?: "left" | "right" | "start" | "end";
        } & {
            children?: React.ReactNode | undefined;
        }): import("react/jsx-runtime").JSX.Element;
        displayName: string;
    };
};
export {};
