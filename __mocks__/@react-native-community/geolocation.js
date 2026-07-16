const FIXED_POSITION = {
  coords: {
    latitude: 0,
    longitude: 0,
    altitude: null,
    accuracy: 5,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 0,
};

let nextWatchId = 1;

const Geolocation = {
  getCurrentPosition: jest.fn((success) => success(FIXED_POSITION)),
  watchPosition: jest.fn((success) => {
    success(FIXED_POSITION);
    return nextWatchId++;
  }),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  requestAuthorization: jest.fn((success) => success?.()),
  setRNConfiguration: jest.fn(),
};

module.exports = Geolocation;
module.exports.default = Geolocation;
