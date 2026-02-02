"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarStackMore = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const React = tslib_1.__importStar(require("react"));
const Avatar_1 = require("../Avatar/index.js");
const cn_1 = require("../utils/cn.js");
const i18n_1 = tslib_1.__importDefault(require("./i18n/index.js"));
const b = (0, cn_1.block)('avatar-stack');
/**
 * Badge for displaying count of remaining avatars
 */
exports.AvatarStackMore = React.forwardRef(({ className, count, 'aria-label': ariaLabel, borderColor = 'var(--g-color-line-generic-solid)', size = Avatar_1.DEFAULT_AVATAR_SIZE, }, ref) => {
    const { t } = i18n_1.default.useTranslation();
    return ((0, jsx_runtime_1.jsxs)("div", { ref: ref, className: b('more', { size, 'has-border': Boolean(borderColor) }, className), "aria-label": ariaLabel || t('more', { count }), style: { borderColor }, children: ["+", count] }));
});
exports.AvatarStackMore.displayName = 'AvatarStack.More';
//# sourceMappingURL=AvatarStackMore.js.map
