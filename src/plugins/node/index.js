'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var EventEmitter = _interopDefault(require('events'));
var eventContext = require('event-context');

var instanceMap = new WeakMap;
var listenerMap = new WeakMap;
var nextTick = process.nextTick;
var proto = EventEmitter.prototype;
var eEmit = proto.emit;
var eAddListener = proto.addListener;
var ePrependListener = proto.prependListener;
var eRemoveListener = proto.removeListener;
var eListeners = proto.listeners;
var patch = function () {
  process.nextTick = function (callback) {
    var rest = [], len = arguments.length - 1;
    while ( len-- > 0 ) rest[ len ] = arguments[ len + 1 ];

    var ctx = eventContext.getCurrentContext();
    if (!ctx) {
      return nextTick.apply(void 0, [ callback ].concat( rest ));
    }

    if (callback.__test === true) {
    }

    var computation = function () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      eventContext.setCurrentContext(ctx);
      callback.apply(void 0, args);
      eventContext.revertContext();
    }

    nextTick.apply(void 0, [ computation ].concat( rest ))
  }

  var wrap = function (nativeAddFunction) { return function (type, handler) {
    var this$1 = this;

    var ctx = eventContext.getCurrentContext();
    if (!ctx) {
      return nativeAddFunction.call(this, type, handler);
    }

    var computation = function () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      eventContext.setCurrentContext(ctx);
      var ret = handler.call.apply(handler, [ this$1 ].concat( args ));
      eventContext.revertContext();
      return ret;
    }

    if (handler.listener) {
      computation.listener = handler.listener;
    }

    var handlerMap = instanceMap.get(this) || new WeakMap();
    handlerMap.set(handler, computation);
    instanceMap.set(this, handlerMap);
    listenerMap.set(computation, handler);
    var dispose = function () {
      eRemoveListener.call(this$1, type, computation);
      var handlerMap = instanceMap.get(this$1);
      if (handlerMap) {
        let computaion = handlerMap.get(handler)
        handlerMap.delete(handler);
        listenerMap.delete(computaion);
      }
    }

    ctx.addDisposable(dispose);
    return nativeAddFunction.call(this, type, computation);
  }; }


  proto.addListener = proto.on = wrap(eAddListener);
  proto.prependListener = wrap(ePrependListener);

  proto.listeners = function (type) {
    var listeners = eListeners.call(this, type);
    return listeners.map(function (handler) { return listenerMap.get(handler) || handler; });
  }

  proto.removeListener = function (type, listener) {
    var handlerMap = instanceMap.get(this);
    var computation = handlerMap ? handlerMap.get(listener) : null;
    return eRemoveListener.call(this, type, computation || listener);
  }
}

var unpatch = function () {
  process.nextTick = nextTick;
  proto.addListener = proto.on = eAddListener;
  proto.prependListener = ePrependListener;
  proto.removeListener = eRemoveListener;
}

exports.patch = patch;
exports.unpatch = unpatch;
