const RESULTS = {
  UNAVAILABLE: 'unavailable',
  DENIED: 'denied',
  LIMITED: 'limited',
  GRANTED: 'granted',
  BLOCKED: 'blocked',
};

const PERMISSIONS = {
  ANDROID: {
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
    ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
    BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    BLUETOOTH_ADVERTISE: 'android.permission.BLUETOOTH_ADVERTISE',
    BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
  },
  IOS: {},
};

const requestMultiple = jest.fn((permissions) =>
  Promise.resolve(
    Object.fromEntries(permissions.map((permission) => [permission, RESULTS.GRANTED])),
  ),
);

const checkMultiple = jest.fn((permissions) =>
  Promise.resolve(
    Object.fromEntries(permissions.map((permission) => [permission, RESULTS.GRANTED])),
  ),
);

module.exports = { PERMISSIONS, RESULTS, requestMultiple, checkMultiple };
