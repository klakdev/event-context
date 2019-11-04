import EventEmitter from 'events';
import { getCurrentContext, setCurrentContext, revertContext } from 'event-context';

const nextTick = process.nextTick;
const proto = EventEmitter.prototype;
const eEmit = proto.emit;
const eAddListener = proto.addListener;
const ePrependListener = proto.prependListener;
const eRemoveListener = proto.removeListener;
const eListeners = proto.listeners;
const noop = () => {}

export const patch = () => {
  process.nextTick = (callback, ...rest) => {
    const ctx = getCurrentContext();
    if (!ctx) {
      return nextTick(callback, ...rest);
    }

    if (callback.__test === true) {
      console.log(ctx.label);
    }

    const computation = (...args) => {
      setCurrentContext(ctx);
      callback(...args);
      revertContext();
    }

    nextTick(computation, ...rest)
  }

  const wrap = nativeAddFunction => function (type, handler) {
    const ctx = getCurrentContext();
    if (!ctx) {
      return nativeAddFunction.call(this, type, handler);
    }

    const computation = (...args) => {
      setCurrentContext(ctx);
      const ret = handler.call(this, ...args);
      revertContext();
      return ret;
    }

    if (handler.listener) {
      computation.listener = handler.listener;
    }
    
    handler._computation = computation;
    computation._handler = handler;
    return nativeAddFunction.call(this, type, computation);
  }


  proto.addListener = proto.on = wrap(eAddListener);
  proto.prependListener = wrap(ePrependListener);

  proto.listeners = function (type) {
    const listeners = eListeners.call(this, type);
    return listeners.map((compeutation) => compeutation._handler || compeutation );
  }

  proto.removeListener = function (type, listener) {
    const computation = listener ? listener._computation : null;
    return eRemoveListener.call(this, type, computation || listener);
  }
}

export const unpatch = () => {
  process.nextTick = nextTick;
  proto.addListener = proto.on = eAddListener;
  proto.prependListener = ePrependListener;
  proto.removeListener = eRemoveListener;
}
