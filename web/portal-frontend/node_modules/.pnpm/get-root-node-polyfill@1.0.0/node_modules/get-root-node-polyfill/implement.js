var isImplemented = require('./is-implemented');

if (!isImplemented()) {
  Object.defineProperty(Node.prototype, 'getRootNode', {
    enumerable: false,
    configurable: false,
    value: require('./index'),
  });
}
