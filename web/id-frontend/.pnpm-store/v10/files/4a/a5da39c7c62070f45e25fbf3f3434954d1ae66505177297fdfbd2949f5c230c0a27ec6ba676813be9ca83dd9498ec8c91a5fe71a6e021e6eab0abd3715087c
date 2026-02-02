"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColorDisplay = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const React = tslib_1.__importStar(require("react"));
const react_color_1 = require("@uiw/react-color");
const controls_1 = require("../../../../controls/index.js");
const constants_1 = require("../../constants.js");
const types_1 = require("../../types.js");
const utils_1 = require("../../utils.js");
exports.ColorDisplay = React.forwardRef(({ hsva, withAlpha, size = 'm', compact, onClick, onColorChange }, ref) => {
    const [inputValue, setInputValue] = React.useState(() => (0, utils_1.getTextValueByMode)(hsva, types_1.Modes.Hex, withAlpha));
    React.useEffect(() => {
        setInputValue((0, utils_1.getTextValueByMode)(hsva, types_1.Modes.Hex, withAlpha));
    }, [hsva, withAlpha]);
    const handleInputBlur = React.useCallback(() => {
        try {
            const newHsva = (0, utils_1.convertSelectedModeColorToHsva)(inputValue, types_1.Modes.Hex, withAlpha);
            onColorChange?.(newHsva);
        }
        catch {
            setInputValue((0, utils_1.getTextValueByMode)(hsva, types_1.Modes.Hex, withAlpha));
        }
    }, [inputValue, withAlpha, onColorChange, hsva]);
    const swatch = ((0, jsx_runtime_1.jsx)("button", { type: "button", className: (0, constants_1.b)('color-swatch', { size }), onClick: onClick, style: { backgroundColor: (0, react_color_1.hsvaToRgbaString)(hsva) } }));
    return ((0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.b)('picker-wrapper', { compact, size, alpha: withAlpha }), ref: ref, children: (0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.b)('picker-handlers'), children: compact ? (swatch) : ((0, jsx_runtime_1.jsx)(controls_1.TextInput, { size: size, startContent: swatch, value: inputValue, onChange: (e) => setInputValue(e.target.value), onBlur: handleInputBlur })) }) }));
});
exports.ColorDisplay.displayName = 'ColorDisplay';
//# sourceMappingURL=ColorDisplay.js.map
