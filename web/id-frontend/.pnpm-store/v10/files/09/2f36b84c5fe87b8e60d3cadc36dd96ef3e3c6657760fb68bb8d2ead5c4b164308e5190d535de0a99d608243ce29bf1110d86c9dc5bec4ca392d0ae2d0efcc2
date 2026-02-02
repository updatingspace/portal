import { jsx as _jsx } from "react/jsx-runtime";
import { Copy, CopyCheck, CopyXmark } from '@gravity-ui/icons';
import { Icon } from "../Icon/index.js";
export function ClipboardIcon({ status, ...rest }) {
    if (status === 'error') {
        return _jsx(Icon, { data: CopyXmark, ...rest });
    }
    if (status === 'success') {
        return _jsx(Icon, { data: CopyCheck, ...rest });
    }
    return _jsx(Icon, { data: Copy, ...rest });
}
//# sourceMappingURL=ClipboardIcon.js.map
