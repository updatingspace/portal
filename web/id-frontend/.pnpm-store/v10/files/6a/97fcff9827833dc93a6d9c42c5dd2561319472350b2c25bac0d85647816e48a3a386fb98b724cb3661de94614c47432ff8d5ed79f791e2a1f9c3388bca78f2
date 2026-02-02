import { jsx as _jsx } from "react/jsx-runtime";
import { ProgressInnerText } from "./ProgressInnerText.js";
import { progressBlock } from "./constants.js";
import { getOffset, getTheme } from "./utils.js";
export function ProgressWithValue(props) {
    const { value, loading, text } = props;
    const offset = getOffset(value);
    if (!Number.isFinite(value)) {
        return null;
    }
    return (_jsx("div", { className: progressBlock('item', { theme: getTheme(props), loading }), style: { transform: `translateX(calc(var(--g-flow-direction) * ${offset}%))` }, children: _jsx(ProgressInnerText, { offset: offset, text: text }) }));
}
//# sourceMappingURL=ProgressWithValue.js.map
