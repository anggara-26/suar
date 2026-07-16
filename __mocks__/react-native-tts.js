const Tts = {
  getInitStatus: jest.fn(() => Promise.resolve('success')),
  requestInstallEngine: jest.fn(() => Promise.resolve('success')),
  requestInstallData: jest.fn(() => Promise.resolve('success')),
  setDucking: jest.fn(() => Promise.resolve('success')),
  setDefaultEngine: jest.fn(() => Promise.resolve(true)),
  setDefaultVoice: jest.fn(() => Promise.resolve('success')),
  setDefaultRate: jest.fn(() => Promise.resolve('success')),
  setDefaultPitch: jest.fn(() => Promise.resolve('success')),
  setDefaultLanguage: jest.fn(() => Promise.resolve('success')),
  setIgnoreSilentSwitch: jest.fn(() => Promise.resolve(true)),
  voices: jest.fn(() => Promise.resolve([])),
  engines: jest.fn(() => Promise.resolve([])),
  speak: jest.fn(() => 'utterance-id'),
  stop: jest.fn(() => Promise.resolve(true)),
  pause: jest.fn(() => Promise.resolve(true)),
  resume: jest.fn(() => Promise.resolve(true)),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

module.exports = Tts;
module.exports.default = Tts;
