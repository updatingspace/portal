import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { Ellipsis, EllipsisVertical } from '@gravity-ui/icons';
import { Button } from "../../Button/index.js";
import { BUTTON_ICON_SIZE_MAP } from "../../Button/constants.js";
import { Icon } from "../../Icon/index.js";
export const MenuTrigger = React.forwardRef(({ size = 'm', children, icon = 'horizontal', ...restProps }, ref) => {
    return (_jsx(Button, { ref: ref, size: size, ...restProps, children: children ? (children) : (_jsx(Icon, { data: icon === 'vertical' ? EllipsisVertical : Ellipsis, size: BUTTON_ICON_SIZE_MAP[size] })) }));
});
MenuTrigger.displayName = 'Menu.Trigger';
//# sourceMappingURL=MenuTrigger.js.map
