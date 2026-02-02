"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTab = useTab;
const tslib_1 = require("tslib");
const React = tslib_1.__importStar(require("react"));
const constants_1 = require("../../../constants.js");
const constants_2 = require("../constants.js");
const TabContext_1 = require("../contexts/TabContext.js");
function useTab(tabProps) {
    const tabContext = React.useContext(TabContext_1.TabContext);
    if (!tabContext) {
        throw new Error('<Tab> must be used within <TabList>');
    }
    const currentValue = tabContext.value;
    const tabId = `${tabContext.id}:t:${tabProps.value}`;
    const panelId = tabContext.isProvider ? `${tabContext.id}:p:${tabProps.value}` : undefined;
    const isSelected = currentValue === tabProps.value;
    const isDisabled = tabProps.disabled;
    const isFocused = tabContext.isFocused;
    const onClick = (event) => {
        if (tabProps.disabled) {
            return;
        }
        if (tabProps.onClick) {
            tabProps.onClick(event);
        }
        if (!event.defaultPrevented) {
            tabContext.onUpdate?.(tabProps.value);
        }
    };
    const onKeyDown = (event) => {
        if (tabProps.disabled) {
            return;
        }
        if (tabProps.onKeyDown) {
            tabProps.onKeyDown(event);
        }
        if (!event.defaultPrevented &&
            (event.key === constants_1.KeyCode.SPACEBAR || event.key === constants_1.KeyCode.ENTER)) {
            tabContext.onUpdate?.(tabProps.value);
        }
    };
    const { value: _value, icon: _icon, counter: _counter, label: _label, disabled: _disabled, href: _href, component: _component, qa: _qa, ...htmlProps } = tabProps;
    return {
        ...htmlProps,
        role: 'tab',
        'aria-selected': isSelected,
        'aria-disabled': isDisabled,
        'aria-controls': panelId,
        id: tabId,
        tabIndex: isSelected && !isDisabled && !isFocused ? 0 : -1,
        onClick,
        onKeyDown,
        className: (0, constants_2.bTab)({ active: isSelected, disabled: isDisabled }, tabProps.className),
        'data-qa': tabProps.qa,
        [constants_2.TAB_DATA_ATTRIBUTE]: tabProps.value,
    };
}
//# sourceMappingURL=useTab.js.map
