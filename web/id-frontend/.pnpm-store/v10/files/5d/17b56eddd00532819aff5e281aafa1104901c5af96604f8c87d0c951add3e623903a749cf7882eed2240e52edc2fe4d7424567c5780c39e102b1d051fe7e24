'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMobile } from "../mobile/index.js";
import { block } from "../utils/cn.js";
import { PaginationButton, PaginationEllipsis, PaginationInput, PaginationPage, PaginationPageOf, PaginationPageSizer, } from "./components/index.js";
import { usePagination } from "./hooks/usePagination.js";
import { getResultPage, getResultTotal, getSize } from "./utils.js";
import "./Pagination.css";
const b = block('pagination');
export const Pagination = ({ page, pageSize, total, size: propSize, onUpdate, compact: propCompact = true, pageSizeOptions, showPages = true, showInput = false, className, qa, }) => {
    const mobile = useMobile();
    const size = getSize({ propSize, mobile });
    const compact = mobile ? true : propCompact;
    const resultTotal = getResultTotal(total);
    const resultPage = getResultPage({
        page,
        total: resultTotal,
        pageSize,
    });
    const { items, numberOfPages } = usePagination({
        page: resultPage,
        pageSize,
        total: resultTotal,
        mobile,
    });
    const pagination = items
        .map((item) => {
        switch (item.type) {
            case 'page':
                return (showPages && (_jsx(PaginationPage, { size: size, pageSize: pageSize, item: item, onUpdate: onUpdate, className: b('pagination-item') }, item.key)));
            case 'ellipsis':
                return (showPages && (_jsx(PaginationEllipsis, { size: size, className: b('pagination-item') }, item.type)));
            case 'pageOf':
                return (showPages && (_jsx(PaginationPageOf, { className: b('pagination-item'), size: size }, item.type)));
            case 'button':
                return (_jsx(PaginationButton, { size: size, item: item, page: resultPage, pageSize: pageSize, onUpdate: onUpdate, compact: compact, className: b('pagination-item') }, item.action));
            default:
                return null;
        }
    })
        .filter(Boolean);
    return (_jsxs("div", { className: b(null, className), "data-qa": qa, children: [pagination, showInput && (_jsx(PaginationInput, { numberOfPages: numberOfPages, pageSize: pageSize, size: size, onUpdate: onUpdate, className: b('input') })), pageSizeOptions && (_jsx(PaginationPageSizer, { onUpdate: onUpdate, page: resultPage, pageSize: pageSize, pageSizeOptions: pageSizeOptions, size: size, total: resultTotal, className: b('page-sizer') }))] }));
};
//# sourceMappingURL=Pagination.js.map
