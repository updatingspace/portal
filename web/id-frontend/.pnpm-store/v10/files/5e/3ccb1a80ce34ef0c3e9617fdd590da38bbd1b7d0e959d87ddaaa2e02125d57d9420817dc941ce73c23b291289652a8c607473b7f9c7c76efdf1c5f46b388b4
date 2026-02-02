'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetContentContainer = void 0;
const tslib_1 = require("tslib");
const jsx_runtime_1 = require("react/jsx-runtime");
const React = tslib_1.__importStar(require("react"));
const mobile_1 = require("../mobile/index.js");
const warn_1 = require("../utils/warn.js");
const constants_1 = require("./constants.js");
const utils_1 = require("./utils.js");
require("./Sheet.css");
const TRANSITION_DURATION = '0.3s';
const HIDE_THRESHOLD = 50;
const ACCELERATION_Y_MAX = 0.08;
const ACCELERATION_Y_MIN = -0.02;
const DEFAULT_MAX_CONTENT_HEIGHT_FROM_VIEWPORT_COEFFICIENT = 0.9;
const WINDOW_RESIZE_TIMEOUT = 50;
let hashHistory = [];
function warnAboutOutOfRange() {
    (0, warn_1.warnOnce)('[Sheet] The value of the "maxContentHeightCoefficient" property must be between 0 and 1');
}
class SheetContent extends React.Component {
    static defaultProps = {
        id: 'sheet',
        allowHideOnContentScroll: true,
    };
    veilRef = React.createRef();
    sheetRef = React.createRef();
    sheetTopRef = React.createRef();
    sheetMarginBoxRef = React.createRef();
    sheetScrollContainerRef = React.createRef();
    velocityTracker = new utils_1.VelocityTracker();
    observer = null;
    resizeWindowTimer = null;
    state = {
        startScrollTop: 0,
        startY: 0,
        deltaY: 0,
        prevSheetHeight: 0,
        swipeAreaTouched: false,
        contentTouched: false,
        veilTouched: false,
        isAnimating: false,
        inWindowResizeScope: false,
        delayedResize: false,
    };
    componentDidMount() {
        this.addListeners();
        this.show();
        const initialHeight = this.getAvailableContentHeight(this.sheetContentHeight);
        this.setInitialStyles(initialHeight);
        this.setState({
            prevSheetHeight: initialHeight,
        });
    }
    componentDidUpdate(prevProps) {
        const { visible, location } = this.props;
        if (!prevProps.visible && visible) {
            this.show();
        }
        if ((prevProps.visible && !visible) || this.shouldClose(prevProps)) {
            this.hide();
        }
        if (prevProps.location.pathname !== location.pathname) {
            hashHistory = [];
        }
    }
    componentWillUnmount() {
        this.removeListeners();
    }
    render() {
        const { content, contentClassName, swipeAreaClassName, hideTopBar, title } = this.props;
        const { deltaY, swipeAreaTouched, contentTouched, veilTouched } = this.state;
        const veilTransitionMod = {
            'with-transition': !deltaY || veilTouched,
        };
        const sheetTransitionMod = {
            'with-transition': veilTransitionMod['with-transition'],
        };
        const contentMod = {
            'without-scroll': (deltaY > 0 && contentTouched) || swipeAreaTouched,
        };
        const marginBoxMod = {
            'always-full-height': this.props.alwaysFullHeight,
        };
        return ((0, jsx_runtime_1.jsxs)(React.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { ref: this.veilRef, className: (0, constants_1.sheetBlock)('veil', veilTransitionMod), onClick: this.onVeilClick, onTransitionEnd: this.onVeilTransitionEnd, role: "presentation", "data-qa": constants_1.SheetQa.VEIL }), (0, jsx_runtime_1.jsxs)("div", { ref: this.sheetRef, className: (0, constants_1.sheetBlock)('sheet', sheetTransitionMod), role: "dialog", "aria-modal": "true", "aria-label": title, children: [!hideTopBar && ((0, jsx_runtime_1.jsx)("div", { ref: this.sheetTopRef, className: (0, constants_1.sheetBlock)('sheet-top'), children: (0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.sheetBlock)('sheet-top-resizer') }) })), (0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.sheetBlock)('sheet-swipe-area', swipeAreaClassName), onTouchStart: this.onSwipeAreaTouchStart, onTouchMove: this.onSwipeAriaTouchMove, onTouchEnd: this.onSwipeAriaTouchEnd }), (0, jsx_runtime_1.jsx)("div", { ref: this.sheetScrollContainerRef, className: (0, constants_1.sheetBlock)('sheet-scroll-container', contentMod), onTouchStart: this.onContentTouchStart, onTouchMove: this.onContentTouchMove, onTouchEnd: this.onContentTouchEnd, onTransitionEnd: this.onContentTransitionEnd, children: (0, jsx_runtime_1.jsx)("div", { ref: this.sheetMarginBoxRef, className: (0, constants_1.sheetBlock)('sheet-margin-box', marginBoxMod), children: (0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.sheetBlock)('sheet-margin-box-border-compensation'), children: (0, jsx_runtime_1.jsxs)("div", { className: (0, constants_1.sheetBlock)('sheet-content', contentClassName), children: [title && ((0, jsx_runtime_1.jsx)("div", { className: (0, constants_1.sheetBlock)('sheet-content-title'), children: title })), content] }) }) }) })] })] }));
    }
    get veilOpacity() {
        return this.veilRef.current?.style.opacity || 0;
    }
    get sheetTopHeight() {
        return this.sheetTopRef.current?.getBoundingClientRect().height || 0;
    }
    get sheetHeight() {
        return this.sheetRef.current?.getBoundingClientRect().height || 0;
    }
    get sheetScrollTop() {
        return this.sheetScrollContainerRef.current?.scrollTop || 0;
    }
    get sheetContentHeight() {
        return this.sheetMarginBoxRef.current?.getBoundingClientRect().height || 0;
    }
    setInitialStyles(initialHeight) {
        if (this.sheetScrollContainerRef.current && this.sheetMarginBoxRef.current) {
            this.sheetScrollContainerRef.current.style.height = `${initialHeight}px`;
        }
    }
    setStyles = ({ status, deltaHeight = 0 }) => {
        if (!this.sheetRef.current || !this.veilRef.current) {
            return;
        }
        const visibleHeight = this.sheetHeight - deltaHeight;
        const translate = status === 'showing'
            ? `translate3d(0, -${visibleHeight}px, 0)`
            : 'translate3d(0, 0, 0)';
        let opacity = 0;
        if (status === 'showing') {
            opacity = deltaHeight === 0 ? 1 : visibleHeight / this.sheetHeight;
        }
        this.veilRef.current.style.opacity = String(opacity);
        this.sheetRef.current.style.transform = translate;
        if (this.isPrefersReducedMotion) {
            this.sheetRef.current.style.opacity = String(opacity);
            this.sheetRef.current.style.transform = `translate3d(0, -${visibleHeight}px, 0)`;
        }
    };
    getAvailableContentHeight = (sheetHeight) => {
        let heightCoefficient = DEFAULT_MAX_CONTENT_HEIGHT_FROM_VIEWPORT_COEFFICIENT;
        if (typeof this.props.maxContentHeightCoefficient === 'number' &&
            this.props.maxContentHeightCoefficient >= 0 &&
            this.props.maxContentHeightCoefficient <= 1) {
            heightCoefficient = this.props.maxContentHeightCoefficient;
        }
        else if (typeof this.props.maxContentHeightCoefficient === 'number') {
            warnAboutOutOfRange();
        }
        const availableViewportHeight = window.innerHeight * heightCoefficient - this.sheetTopHeight;
        if (this.props.alwaysFullHeight) {
            return availableViewportHeight;
        }
        const availableContentHeight = sheetHeight >= availableViewportHeight ? availableViewportHeight : sheetHeight;
        return availableContentHeight;
    };
    show = () => {
        this.setState({ isAnimating: true }, () => {
            this.setStyles({ status: 'showing' });
            this.setHash();
        });
    };
    hide = () => {
        this.setState({ isAnimating: true }, () => {
            this.setStyles({ status: 'hiding' });
            this.removeHash();
        });
    };
    onSwipeAreaTouchStart = (e) => {
        this.velocityTracker.clear();
        this.setState({
            startY: e.nativeEvent.touches[0].clientY,
            swipeAreaTouched: true,
        });
    };
    onContentTouchStart = (e) => {
        if (!this.props.allowHideOnContentScroll || this.state.swipeAreaTouched) {
            return;
        }
        this.velocityTracker.clear();
        this.setState({
            startY: e.nativeEvent.touches[0].clientY,
            startScrollTop: this.sheetScrollTop,
            contentTouched: true,
        });
    };
    onSwipeAriaTouchMove = (e) => {
        const delta = e.nativeEvent.touches[0].clientY - this.state.startY;
        this.velocityTracker.addMovement({
            x: e.nativeEvent.touches[0].clientX,
            y: e.nativeEvent.touches[0].clientY,
        });
        this.setState({ deltaY: delta });
        if (delta <= 0) {
            return;
        }
        this.setStyles({ status: 'showing', deltaHeight: delta });
    };
    onContentTouchMove = (e) => {
        if (!this.props.allowHideOnContentScroll) {
            return;
        }
        if (!this.state.startY) {
            this.onContentTouchStart(e);
            return;
        }
        const { startScrollTop, swipeAreaTouched } = this.state;
        if (swipeAreaTouched ||
            this.sheetScrollTop > 0 ||
            (startScrollTop > 0 && startScrollTop !== this.sheetScrollTop)) {
            return;
        }
        const delta = e.nativeEvent.touches[0].clientY - this.state.startY;
        this.velocityTracker.addMovement({
            x: e.nativeEvent.touches[0].clientX,
            y: e.nativeEvent.touches[0].clientY,
        });
        // if allowHideOnContentScroll is true and delta <= 0, it's a content scroll
        // animation is not needed
        if (delta <= 0) {
            this.setState({ deltaY: 0 });
            return;
        }
        this.setState({ deltaY: delta });
        this.setStyles({ status: 'showing', deltaHeight: delta });
    };
    onTouchEndAction = (deltaY) => {
        const accelerationY = this.velocityTracker.getYAcceleration();
        if (this.sheetHeight <= deltaY) {
            this.props.hideSheet();
        }
        else if ((deltaY > HIDE_THRESHOLD &&
            accelerationY <= ACCELERATION_Y_MAX &&
            accelerationY >= ACCELERATION_Y_MIN) ||
            accelerationY > ACCELERATION_Y_MAX) {
            this.hide();
        }
        else if (deltaY !== 0) {
            this.show();
        }
    };
    onSwipeAriaTouchEnd = () => {
        const { deltaY } = this.state;
        this.onTouchEndAction(deltaY);
        this.setState({
            startY: 0,
            deltaY: 0,
            swipeAreaTouched: false,
        });
    };
    onContentTouchEnd = () => {
        const { deltaY, swipeAreaTouched } = this.state;
        if (!this.props.allowHideOnContentScroll || swipeAreaTouched) {
            return;
        }
        this.onTouchEndAction(deltaY);
        this.setState({
            startY: 0,
            deltaY: 0,
            contentTouched: false,
        });
    };
    onVeilClick = () => {
        if (this.state.isAnimating) {
            return;
        }
        this.setState({ veilTouched: true });
        this.hide();
    };
    onVeilTransitionEnd = () => {
        this.setState({ isAnimating: false });
        if (this.veilOpacity === '0') {
            this.props.hideSheet();
            return;
        }
        if (this.state.delayedResize) {
            this.onResizeWindow();
            this.setState({ delayedResize: false });
        }
    };
    onContentTransitionEnd = (e) => {
        if (e.propertyName === 'height') {
            if (this.sheetScrollContainerRef.current) {
                this.sheetScrollContainerRef.current.style.transition = 'none';
            }
        }
    };
    onResizeWindow = () => {
        if (this.state.isAnimating) {
            this.setState({ delayedResize: true });
            return;
        }
        this.setState({ inWindowResizeScope: true });
        if (this.resizeWindowTimer) {
            window.clearTimeout(this.resizeWindowTimer);
        }
        this.resizeWindowTimer = window.setTimeout(() => {
            this.onResize();
        }, WINDOW_RESIZE_TIMEOUT);
    };
    onResize = () => {
        if (!this.sheetRef.current || !this.sheetScrollContainerRef.current) {
            return;
        }
        const sheetContentHeight = this.sheetContentHeight;
        if (sheetContentHeight === this.state.prevSheetHeight && !this.state.inWindowResizeScope) {
            return;
        }
        const availableContentHeight = this.getAvailableContentHeight(sheetContentHeight);
        this.sheetScrollContainerRef.current.style.transition =
            this.state.prevSheetHeight > sheetContentHeight
                ? `height 0s ease ${TRANSITION_DURATION}`
                : 'none';
        this.sheetScrollContainerRef.current.style.height = `${availableContentHeight}px`;
        this.sheetRef.current.style.transform = `translate3d(0, -${availableContentHeight + this.sheetTopHeight}px, 0)`;
        this.setState({ prevSheetHeight: sheetContentHeight, inWindowResizeScope: false });
    };
    addListeners() {
        window.addEventListener('resize', this.onResizeWindow);
        if (this.sheetMarginBoxRef.current) {
            this.observer = new ResizeObserver(() => {
                if (!this.state.inWindowResizeScope) {
                    this.onResize();
                }
            });
            this.observer.observe(this.sheetMarginBoxRef.current);
        }
    }
    removeListeners() {
        window.removeEventListener('resize', this.onResizeWindow);
        if (this.observer) {
            this.observer.disconnect();
        }
    }
    setHash() {
        const { id, platform, location, history } = this.props;
        if (platform === mobile_1.Platform.BROWSER) {
            return;
        }
        const newLocation = { ...location, hash: id };
        switch (platform) {
            case mobile_1.Platform.IOS:
                if (location.hash) {
                    hashHistory.push(location.hash);
                }
                history.replace(newLocation);
                break;
            case mobile_1.Platform.ANDROID:
                history.push(newLocation);
                break;
        }
    }
    removeHash() {
        const { id, platform, location, history } = this.props;
        if (platform === mobile_1.Platform.BROWSER || location.hash !== `#${id}`) {
            return;
        }
        switch (platform) {
            case mobile_1.Platform.IOS:
                history.replace({ ...location, hash: hashHistory.pop() ?? '' });
                break;
            case mobile_1.Platform.ANDROID:
                history.goBack();
                break;
        }
    }
    shouldClose(prevProps) {
        const { id, platform, location, history } = this.props;
        return (platform !== mobile_1.Platform.BROWSER &&
            history.action === 'POP' &&
            prevProps.location.hash !== location.hash &&
            location.hash !== `#${id}`);
    }
    get isPrefersReducedMotion() {
        return Boolean(window?.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
}
function withRouterWrapper(Component) {
    const ComponentWithRouter = (props) => {
        const { useHistory, useLocation, ...remainingProps } = props;
        return (0, jsx_runtime_1.jsx)(Component, { ...remainingProps, history: useHistory(), location: useLocation() });
    };
    const componentName = Component.displayName || Component.name || 'Component';
    ComponentWithRouter.displayName = `withRouterWrapper(${componentName})`;
    return ComponentWithRouter;
}
exports.SheetContentContainer = (0, mobile_1.withMobile)(withRouterWrapper(SheetContent));
//# sourceMappingURL=SheetContent.js.map
