declare interface GetRootNodeOptions {
    composed?: boolean;
}

declare interface Node {
    getRootNode(options?: GetRootNodeOptions): Node;
}
