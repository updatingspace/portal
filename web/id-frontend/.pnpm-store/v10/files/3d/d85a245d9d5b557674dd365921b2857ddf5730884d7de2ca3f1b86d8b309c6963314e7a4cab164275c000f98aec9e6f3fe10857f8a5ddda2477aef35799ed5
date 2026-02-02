import * as React from 'react';
import type { History, Location } from "./MobileContext.js";
import { Platform } from "./constants.js";
export interface MobileProviderProps {
    children?: React.ReactNode;
    mobile?: boolean;
    platform?: Platform;
    useHistory?: () => Omit<History, 'goBack'> & {
        back?: () => void;
        goBack?: () => void;
    };
    useLocation?: () => Location;
}
export declare function MobileProvider({ mobile, platform, useHistory, useLocation, children, }: MobileProviderProps): import("react/jsx-runtime").JSX.Element;
