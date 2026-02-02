'use client';
import * as React from 'react';
import { copyText } from "./copyText.js";
const INITIAL_STATUS = 'pending';
export function CopyToClipboard(props) {
    const { children, text, timeout, onCopy } = props;
    const textRef = React.useRef('');
    const [status, setStatus] = React.useState(INITIAL_STATUS);
    const timerIdRef = React.useRef();
    const content = typeof children === 'function' ? children(status) : children;
    const handleCopy = React.useCallback((copyText, result) => {
        setStatus(result ? 'success' : 'error');
        window.clearTimeout(timerIdRef.current);
        timerIdRef.current = window.setTimeout(() => setStatus(INITIAL_STATUS), timeout);
        onCopy?.(copyText, result);
    }, [onCopy, timeout]);
    const onClickWithCopy = React.useCallback((event) => {
        const currentText = typeof text === 'function' ? text() : text;
        textRef.current = currentText;
        function copy(result) {
            if (currentText === textRef.current) {
                handleCopy(currentText, result);
                content.props?.onClick?.(event);
            }
        }
        copyText(currentText).then(() => {
            copy(true);
        }, () => {
            copy(false);
        });
    }, [content.props, handleCopy, text]);
    React.useEffect(() => () => window.clearTimeout(timerIdRef.current), []);
    if (!React.isValidElement(content)) {
        throw new Error('Content must be a valid react element');
    }
    return React.cloneElement(content, {
        onClick: onClickWithCopy,
    });
}
//# sourceMappingURL=CopyToClipboard.js.map
