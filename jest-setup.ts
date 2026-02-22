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
  RN.Animated.timing = (value: { setValue: (v: number) => void }, config: { toValue: number }) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      value.setValue(config.toValue);
      callback && callback({ finished: true });
    },
  });
  RN.Animated.spring = (value: { setValue: (v: number) => void }, config: { toValue: number }) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      value.setValue(config.toValue);
      callback && callback({ finished: true });
    },
  });
  RN.Animated.parallel = (animations: { start: (cb?: (res: { finished: boolean }) => void) => void }[]) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      animations.forEach(a => a.start());
      callback && callback({ finished: true });
    },
  });
  RN.InteractionManager.runAfterInteractions = (cb?: () => void) => { 
    cb && cb(); 
    return { cancel: () => {} }; 
  };
  RN.Linking.openURL = jest.fn().mockResolvedValue(true);
  RN.Linking.canOpenURL = jest.fn().mockResolvedValue(true);
  RN.Linking.getInitialURL = jest.fn().mockResolvedValue(null);

  return RN;
});

