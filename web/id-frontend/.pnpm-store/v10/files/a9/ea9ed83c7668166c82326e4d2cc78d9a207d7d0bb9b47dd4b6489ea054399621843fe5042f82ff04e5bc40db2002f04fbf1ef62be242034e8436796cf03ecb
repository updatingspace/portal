'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Link = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const React = tslib_1.__importStar(require("react"));
const cn_1 = require("../utils/cn.js");
const event_broker_1 = require("../utils/event-broker/index.js");
require("./Link.css");
const b = (0, cn_1.block)('link');
exports.Link = React.forwardRef(function Link({ view = 'normal', visitable = false, underline = false, href, children, extraProps, qa, onClickCapture, ...props }, ref) {
    const handleClickCapture = React.useCallback((event) => {
        event_broker_1.eventBroker.publish({
            componentId: 'Link',
            eventId: 'click',
            domEvent: event,
        });
        if (onClickCapture) {
            onClickCapture(event);
        }
    }, [onClickCapture]);
    return ((0, jsx_runtime_1.jsx)("a", { ...props, ...extraProps, ref: ref, href: href, rel: props.target === '_blank' && !props.rel ? 'noopener noreferrer' : props.rel, onClickCapture: handleClickCapture, className: b({ view, visitable, underline }, props.className), "data-qa": qa, children: children }));
});
//# sourceMappingURL=Link.js.map
