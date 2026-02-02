import { jsx as _jsx } from "react/jsx-runtime";
import { block } from "../utils/cn.js";
import { warnOnce } from "../utils/warn.js";
const b = block('button');
function warnAboutPhysicalValues() {
    warnOnce('[Button.Icon] Physical values (left, right) of "side" property are deprecated. Use logical values (start, end) instead.');
}
export const ButtonIcon = ({ side, className, children }) => {
    return (_jsx("span", { className: b('icon', {
            side: getIconSide(side),
        }, className), children: _jsx("span", { className: b('icon-inner'), children: children }) }));
};
ButtonIcon.displayName = 'Button.Icon';
export function getIconSide(side) {
    let sideMod = side;
    if (sideMod === 'left') {
        warnAboutPhysicalValues();
        sideMod = 'start';
    }
    if (sideMod === 'right') {
        warnAboutPhysicalValues();
        sideMod = 'end';
    }
    return sideMod;
}
//# sourceMappingURL=ButtonIcon.js.map
