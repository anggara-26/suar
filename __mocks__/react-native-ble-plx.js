const State = {
  Unknown: 'Unknown',
  Resetting: 'Resetting',
  Unsupported: 'Unsupported',
  Unauthorized: 'Unauthorized',
  PoweredOff: 'PoweredOff',
  PoweredOn: 'PoweredOn',
};

class BleManager {
  state() {
    return Promise.resolve(State.PoweredOn);
  }

  onStateChange(listener, emitCurrentState) {
    if (emitCurrentState) listener(State.PoweredOn);
    return { remove: jest.fn() };
  }

  enable() {
    return Promise.resolve(this);
  }

  disable() {
    return Promise.resolve(this);
  }
}

module.exports = { BleManager, State };
