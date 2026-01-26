// Mock react-native-nitro-modules
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => ({})),
  },
}))

// Standard react-native preset is usually enough
// but we might need to mock some native components
// Mock Animated to run immediately
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Animated.timing = (value: any, config: any) => ({
    start: (callback: any) => {
      value.setValue(config.toValue);
      callback && callback({ finished: true });
    },
  });
  RN.Animated.spring = (value: any, config: any) => ({
    start: (callback: any) => {
      value.setValue(config.toValue);
      callback && callback({ finished: true });
    },
  });
  RN.Animated.parallel = (animations: any[]) => ({
    start: (callback: any) => {
      animations.forEach(a => a.start());
      callback && callback({ finished: true });
    },
  });
  return RN;
});

