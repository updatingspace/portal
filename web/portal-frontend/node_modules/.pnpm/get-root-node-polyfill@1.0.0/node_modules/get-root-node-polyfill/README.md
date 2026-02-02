# `Node.prototype.getRootNode` polyfill

Polyfill for the new DOM method `Node.prototype.getRootNode` as defined 
by the [DOM specification](https://dom.spec.whatwg.org/#dom-node-getrootnode)

## Install

`npm install --save get-root-node-polyfill`

## Usage

```javascript
// Implement the method if it does not already exist:
require('get-root-node-polyfill/implement');
aDiv.getRootNode({ composed: false }); // options are optional, defaults to composed = false.

// Get the method without touching Node.prototype
const getRootNode = require('get-root-node-polyfill');
getRootNode.call(aDiv, { composed: false });

// Check if the method is available on Node.prototype.
const isImplemented = require('get-root-node-polyfill/is-implemented');
isImplemented(); // true if the method is available
```
