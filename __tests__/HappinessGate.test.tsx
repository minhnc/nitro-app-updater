import { render, fireEvent, act } from '@testing-library/react-native';
import { HappinessGate } from '../src/HappinessGate';
import { Animated } from 'react-native'; // Keep Animated as it's used in the mock

// Override the global sync mock from jest-setup.ts to be async for this test
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  const mockAnimation = (value: Animated.Value, config: Animated.TimingAnimationConfig) => ({
    start: (callback?: Animated.EndCallback) => {
      // Use a real timeout to simulate async behavior even with fake timers
      setTimeout(() => {
        // @ts-expect-error Mock animation bypasses strict animated types
        value.setValue(config.toValue);
        callback && callback({ finished: true });
      }, config.duration || 0);
    },
  });

  RN.Animated.timing = mockAnimation;
  RN.Animated.spring = mockAnimation;
  RN.Animated.parallel = (animations: { start: (cb?: (result: { finished: boolean }) => void) => void }[]) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      let completed = 0;
      animations.forEach(a => a.start(() => {
        completed++;
        if (completed === animations.length) {
          callback && callback({ finished: true });
        }
      }));
    },
  });

  return RN;
});

describe('HappinessGate', () => {
  const onPositive = jest.fn();
  const onNegative = jest.fn();
  const onDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should remain in the DOM during closing animation (m3)', async () => {
    const { queryByText, rerender } = render(
      <HappinessGate
        visible={true}
        onPositive={onPositive}
        onNegative={onNegative}
        onDismiss={onDismiss}
      />
    );

    expect(queryByText('Are you enjoying the app?')).toBeTruthy();

    // Trigger positive action which starts closing animation
    await act(async () => {
      fireEvent.press(queryByText('Yes, I love it!')!);
    });

    // Rerender with visible=false
    rerender(
      <HappinessGate
        visible={false}
        onPositive={onPositive}
        onNegative={onNegative}
        onDismiss={onDismiss}
      />
    );

    // It should still be in the DOM because animation is in progress (200ms)
    expect(queryByText('Are you enjoying the app?')).toBeTruthy();

    // Fast forward animation
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    // Now it should be gone
    expect(queryByText('Are you enjoying the app?')).toBeNull();
    expect(onPositive).toHaveBeenCalled();
  });

  it('should handle dismiss during animation', async () => {
    const { queryByText, rerender } = render(
      <HappinessGate
        visible={true}
        onPositive={onPositive}
        onNegative={onNegative}
        onDismiss={onDismiss}
      />
    );

    await act(async () => {
      fireEvent.press(queryByText('Maybe later')!);
    });

    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    // The callback should have fired
    expect(onDismiss).toHaveBeenCalled();

    // Parent reacts to onDismiss by setting visible=false
    rerender(
      <HappinessGate
        visible={false}
        onPositive={onPositive}
        onNegative={onNegative}
        onDismiss={onDismiss}
      />
    );

    expect(queryByText('Are you enjoying the app?')).toBeNull();
  });

  it('should handle tap-outside-to-dismiss via TouchableWithoutFeedback', async () => {
    const { getByTestId } = render(
      <HappinessGate
        visible={true}
        onPositive={onPositive}
        onNegative={onNegative}
        onDismiss={onDismiss}
      />
    );

    await act(async () => {
      fireEvent.press(getByTestId('happiness-gate-overlay'));
    });

    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(onDismiss).toHaveBeenCalled();
  });
});
