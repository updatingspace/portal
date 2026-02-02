'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { block } from "../utils/cn.js";
import { eventBroker } from "../utils/event-broker/index.js";
import "./Link.css";
const b = block('link');
export const Link = React.forwardRef(function Link({ view = 'normal', visitable = false, underline = false, href, children, extraProps, qa, onClickCapture, ...props }, ref) {
    const handleClickCapture = React.useCallback((event) => {
        eventBroker.publish({
            componentId: 'Link',
            eventId: 'click',
            domEvent: event,
        });
        if (onClickCapture) {
            onClickCapture(event);
        }
    }, [onClickCapture]);
    return (_jsx("a", { ...props, ...extraProps, ref: ref, href: href, rel: props.target === '_blank' && !props.rel ? 'noopener noreferrer' : props.rel, onClickCapture: handleClickCapture, className: b({ view, visitable, underline }, props.className), "data-qa": qa, children: children }));
});
//# sourceMappingURL=Link.js.map
