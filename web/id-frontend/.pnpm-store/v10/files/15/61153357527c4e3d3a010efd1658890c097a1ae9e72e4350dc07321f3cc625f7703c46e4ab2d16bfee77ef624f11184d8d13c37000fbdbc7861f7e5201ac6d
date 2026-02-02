'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { createElement as _createElement } from "react";
import * as React from 'react';
import { useRadioGroup } from "../../hooks/private/index.js";
import { Radio } from "../Radio/index.js";
import { block } from "../utils/cn.js";
import "./RadioGroup.css";
const b = block('radio-group');
export const RadioGroup = React.forwardRef(function RadioGroup(props, ref) {
    const { size = 'm', direction = 'horizontal', style, className, optionClassName, qa, children, } = props;
    let options = props.options;
    if (!options) {
        options = React.Children.toArray(children).map(({ props }) => ({
            value: props.value,
            content: props.content || props.children,
            disabled: props.disabled,
            qa: props.qa,
        }));
    }
    const { containerProps, optionsProps } = useRadioGroup({ ...props, options });
    return (_jsx("div", { ...containerProps, ref: ref, style: style, className: b({ size, direction }, className), "data-qa": qa, children: optionsProps.map((optionProps) => (_createElement(Radio, { ...optionProps, key: optionProps.value, className: b('option', optionClassName), size: size }))) }));
});
RadioGroup.Option = Radio;
//# sourceMappingURL=RadioGroup.js.map
