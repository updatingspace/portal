import { getListItemId } from "./getListItemId.js";
import { getGroupItemId } from "./groupItemId.js";
import { isTreeItemGuard } from "./isTreeItemGuard.js";
export function flattenItems({ items, getItemId, expandedById = {}, }) {
    const rootIds = [];
    const getNestedIds = (order, item, index, parentId) => {
        const groupedId = getGroupItemId(index, parentId);
        const id = getListItemId({ groupedId, item, getItemId });
        // only top level array
        if (!parentId) {
            rootIds.push(id);
        }
        order.push(id);
        if (isTreeItemGuard(item) && item.children) {
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
