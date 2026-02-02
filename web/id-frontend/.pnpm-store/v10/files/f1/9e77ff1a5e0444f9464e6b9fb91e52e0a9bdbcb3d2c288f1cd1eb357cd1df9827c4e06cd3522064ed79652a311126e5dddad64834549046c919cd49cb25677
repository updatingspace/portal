"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenItems = flattenItems;
const getListItemId_1 = require("./getListItemId.js");
const groupItemId_1 = require("./groupItemId.js");
const isTreeItemGuard_1 = require("./isTreeItemGuard.js");
function flattenItems({ items, getItemId, expandedById = {}, }) {
    const rootIds = [];
    const getNestedIds = (order, item, index, parentId) => {
        const groupedId = (0, groupItemId_1.getGroupItemId)(index, parentId);
        const id = (0, getListItemId_1.getListItemId)({ groupedId, item, getItemId });
        // only top level array
        if (!parentId) {
            rootIds.push(id);
        }
        order.push(id);
        if ((0, isTreeItemGuard_1.isTreeItemGuard)(item) && item.children) {
            // don't include collapsed groups
            if (!(id in expandedById && !expandedById[id])) {
                order.push(...item.children.reduce((acc, item, idx) => getNestedIds(acc, item, idx, id), []));
            }
        }
        return order;
    };
    const visibleFlattenIds = items.reduce((acc, item, index) => getNestedIds(acc, item, index), []);
    const idToFlattenIndex = {};
    for (const [item, index] of visibleFlattenIds.entries()) {
        idToFlattenIndex[index] = item;
    }
    return {
        rootIds,
        visibleFlattenIds,
        idToFlattenIndex,
    };
}
//# sourceMappingURL=flattenItems.js.map
