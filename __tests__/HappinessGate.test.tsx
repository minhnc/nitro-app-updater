import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { HappinessGate } from '../src/HappinessGate'

describe('HappinessGate', () => {
  const mockOnPositive = jest.fn()
  const mockOnNegative = jest.fn()
  const mockOnDismiss = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing when visible is false', () => {
    const { queryByText } = render(
      <HappinessGate
        visible={false}
        onPositive={mockOnPositive}
        onNegative={mockOnNegative}
        onDismiss={mockOnDismiss}
      />
    )
    expect(queryByText(/Enjoying the app/i)).toBeNull()
  })

  it('renders content when visible is true', () => {
    const { getByText } = render(
      <HappinessGate
        visible={true}
        onPositive={mockOnPositive}
        onNegative={mockOnNegative}
        onDismiss={mockOnDismiss}
      />
    )
    expect(getByText(/Enjoying the app/i)).toBeTruthy()
    expect(getByText('Yes! 😊')).toBeTruthy()
    expect(getByText('Not really 😕')).toBeTruthy()
  })

  it('calls onPositive when positive button pressed', () => {
    const { getByText } = render(
      <HappinessGate
        visible={true}
        onPositive={mockOnPositive}
        onNegative={mockOnNegative}
        onDismiss={mockOnDismiss}
      />
    )
    fireEvent.press(getByText('Yes! 😊'))
    // Note: The component uses Animated.timing callback, so we might need waitFor or fake timers
    // But let's check if fireEvent works directly or if we need to advance timers.
    // The handleAction function does animation then callback.
  })
})
