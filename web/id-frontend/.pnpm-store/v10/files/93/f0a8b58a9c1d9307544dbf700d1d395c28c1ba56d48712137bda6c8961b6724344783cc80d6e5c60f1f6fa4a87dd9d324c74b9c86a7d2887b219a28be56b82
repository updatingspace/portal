import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { hsvaToRgbaString } from '@uiw/react-color';
import { TextInput } from "../../../../controls/index.js";
import { b } from "../../constants.js";
import { Modes } from "../../types.js";
import { convertSelectedModeColorToHsva, getTextValueByMode } from "../../utils.js";
export const ColorDisplay = React.forwardRef(({ hsva, withAlpha, size = 'm', compact, onClick, onColorChange }, ref) => {
    const [inputValue, setInputValue] = React.useState(() => getTextValueByMode(hsva, Modes.Hex, withAlpha));
    React.useEffect(() => {
        setInputValue(getTextValueByMode(hsva, Modes.Hex, withAlpha));
    }, [hsva, withAlpha]);
    const handleInputBlur = React.useCallback(() => {
        try {
            const newHsva = convertSelectedModeColorToHsva(inputValue, Modes.Hex, withAlpha);
            onColorChange?.(newHsva);
        }
        catch {
            setInputValue(getTextValueByMode(hsva, Modes.Hex, withAlpha));
        }
    }, [inputValue, withAlpha, onColorChange, hsva]);
    const swatch = (_jsx("button", { type: "button", className: b('color-swatch', { size }), onClick: onClick, style: { backgroundColor: hsvaToRgbaString(hsva) } }));
    return (_jsx("div", { className: b('picker-wrapper', { compact, size, alpha: withAlpha }), ref: ref, children: _jsx("div", { className: b('picker-handlers'), children: compact ? (swatch) : (_jsx(TextInput, { size: size, startContent: swatch, value: inputValue, onChange: (e) => setInputValue(e.target.value), onBlur: handleInputBlur })) }) }));
});
ColorDisplay.displayName = 'ColorDisplay';
//# sourceMappingURL=ColorDisplay.js.map
