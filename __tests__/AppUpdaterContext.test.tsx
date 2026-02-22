import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { AppUpdaterProvider, useAppUpdaterContext } from '../src/AppUpdaterContext';
import { render } from '@testing-library/react-native';
import { UpdatePrompt } from '../src/UpdatePrompt';

// Mock useAppUpdater
jest.mock('../src/useAppUpdater', () => ({
  useAppUpdater: jest.fn(() => ({
    mockedUpdater: true
  }))
}));

describe('AppUpdaterContext', () => {
  it('should throw when used outside provider', () => {
    // Suppress console.error for expected thrown error in react
    const spy = jest.spyOn(console, 'error');
    spy.mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useAppUpdaterContext());
    }).toThrow('useAppUpdaterContext must be used within AppUpdaterProvider');
    
    spy.mockRestore();
  });

  it('should return updater from provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppUpdaterProvider config={{}}>{children}</AppUpdaterProvider>
    );
    const { result } = renderHook(() => useAppUpdaterContext(), { wrapper });
    expect(result.current).toEqual(expect.objectContaining({
      mockedUpdater: true
    }));
  });

  it('integrates seamlessly with UpdatePrompt via externalUpdater (Testing Gap)', () => {
    const TestConsumer = () => {
      const updater = useAppUpdaterContext();
      // Force available so the prompt displays
      return <UpdatePrompt externalUpdater={{ ...updater, available: true } as any} title="Integration Test Update" />;
    };

    const { getByText } = render(
      <AppUpdaterProvider config={{}}>
        <TestConsumer />
      </AppUpdaterProvider>
    );

    expect(getByText('Integration Test Update')).toBeTruthy();
  });
});
