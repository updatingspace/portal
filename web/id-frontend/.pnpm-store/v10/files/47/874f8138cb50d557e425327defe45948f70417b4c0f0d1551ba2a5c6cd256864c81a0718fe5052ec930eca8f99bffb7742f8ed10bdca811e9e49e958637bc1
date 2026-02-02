'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { useFloatingTree, useListItem } from '@floating-ui/react';
import { ChevronLeft, ChevronRight } from '@gravity-ui/icons';
import { mergeRefs, useForkRef } from "../../../hooks/index.js";
import { BUTTON_ICON_SIZE_MAP } from "../../Button/constants.js";
import { Icon } from "../../Icon/index.js";
import { useDirection } from "../../theme/index.js";
import { block } from "../../utils/cn.js";
import { mergeProps } from "../../utils/mergeProps.js";
import { ListItemView } from "../ListItemView/ListItemView.js";
import { MenuContext } from "./MenuContext.js";
import { MenuItemContext } from "./MenuItemContext.js";
import { isComponentType } from "./utils.js";
import "./MenuItem.css";
function isMenuItemComponentProps(p) {
    return p.component !== undefined;
}
function isMenuItemLinkProps(p) {
    return p.href !== undefined;
}
const b = block('lab-menu-item');
export const MenuItem = React.forwardRef((props, ref) => {
    const { theme, selected, disabled, icon, arrow, children, className, qa, ...restComponentProps } = props;
    const [submenuOpen, setSubmenuOpen] = React.useState(false);
    const [hasFocusInside, setHasFocusInside] = React.useState(false);
    const isRTL = useDirection() === 'rtl';
    const menuContext = React.useContext(MenuContext);
    const menuItemContext = React.useContext(MenuItemContext);
    if (!menuContext) {
        throw new Error('<MenuItem> must be used within <Menu>');
    }
    const item = useListItem();
    const tree = useFloatingTree();
    const isActive = item.index === menuContext.activeIndex;
    const tabIndex = (menuContext.inline && item.index === 0) || isActive ? 0 : -1;
    let submenu = null;
    const preparedChildren = [];
    if (icon) {
        preparedChildren.push(_jsx("div", { className: b('icon'), "aria-hidden": true, children: icon }, "icon"));
    }
    for (const child of React.Children.toArray(children)) {
        if (!menuContext.inline && isComponentType(child, 'Menu')) {
            submenu = child;
        }
        else {
            preparedChildren.push(child);
        }
    }
    if (arrow || submenu) {
        preparedChildren.push(_jsx("div", { className: b('arrow'), "aria-hidden": true, children: arrow ? (arrow) : (_jsx(Icon, { data: isRTL ? ChevronLeft : ChevronRight, size: BUTTON_ICON_SIZE_MAP[menuContext.size] })) }, "arrow"));
    }
    const handleRef = useForkRef(ref, item.ref);
    const handleClick = (event) => {
        props.onClick?.(event);
        if (!submenu) {
            tree?.events.emit('click');
        }
    };
    const handleFocus = (event) => {
        props.onFocus?.(event);
        setHasFocusInside(false);
        menuItemContext?.setHasFocusInside(true);
    };
    let component;
    let componentProps;
    const commonComponentProps = {
        role: 'menuitem',
        tabIndex,
        className: b({
            theme,
            size: menuContext.size,
        }, className),
        'data-qa': qa,
        ...menuContext.getItemProps({
            ...restComponentProps,
            onClick: handleClick,
            onFocus: handleFocus,
        }),
    };
    if (isMenuItemComponentProps(props)) {
        component = props.component;
        componentProps = {
            ...commonComponentProps,
            'aria-disabled': disabled ?? undefined,
        };
    }
    else if (isMenuItemLinkProps(props)) {
        component = 'a';
        componentProps = {
            ...commonComponentProps,
            rel: props.target === '_blank' && !props.rel ? 'noopener noreferrer' : props.rel,
            'aria-disabled': disabled ?? undefined,
        };
    }
    else {
        component = 'button';
        componentProps = {
            ...commonComponentProps,
            type: 'button',
            disabled,
            'aria-disabled': disabled ?? undefined,
            'aria-pressed': selected ?? undefined,
        };
    }
    const content = (_jsx(ListItemView, { isContainer: true, component: component, componentProps: componentProps, ref: handleRef, size: menuContext.size, disabled: disabled, active: isActive && !hasFocusInside, hovered: hasFocusInside || (!isActive && submenuOpen), selected: selected, selectionStyle: "highlight", children: preparedChildren }));
    const contextValue = React.useMemo(() => ({
        setHasFocusInside,
    }), []);
    if (submenu) {
        return (_jsx(MenuItemContext.Provider, { value: contextValue, children: React.cloneElement(submenu, {
                trigger: (triggerProps, triggerRef) => {
                    return React.cloneElement(content, {
                        ref: mergeRefs(triggerRef, handleRef),
                        componentProps: mergeProps(triggerProps, componentProps),
                    });
                },
                onOpenChange: (open, event, reason) => {
                    submenu.props.onOpenChange?.(open, event, reason);
                    setSubmenuOpen(open);
                    if (!open) {
                        setHasFocusInside(false);
                    }
                },
            }) }));
    }
    return content;
});
MenuItem.displayName = 'Menu.Item';
//# sourceMappingURL=MenuItem.js.map
