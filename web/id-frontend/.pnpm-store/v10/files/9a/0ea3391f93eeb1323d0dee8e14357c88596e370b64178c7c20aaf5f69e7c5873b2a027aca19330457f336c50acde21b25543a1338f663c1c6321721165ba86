"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ButtonIcon = void 0;
exports.getIconSide = getIconSide;
const jsx_runtime_1 = require("react/jsx-runtime");
const cn_1 = require("../utils/cn.js");
const warn_1 = require("../utils/warn.js");
const b = (0, cn_1.block)('button');
function warnAboutPhysicalValues() {
    (0, warn_1.warnOnce)('[Button.Icon] Physical values (left, right) of "side" property are deprecated. Use logical values (start, end) instead.');
}
const ButtonIcon = ({ side, className, children }) => {
    return ((0, jsx_runtime_1.jsx)("span", { className: b('icon', {
            side: getIconSide(side),
        }, className), children: (0, jsx_runtime_1.jsx)("span", { className: b('icon-inner'), children: children }) }));
};
exports.ButtonIcon = ButtonIcon;
exports.ButtonIcon.displayName = 'Button.Icon';
function getIconSide(side) {
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
