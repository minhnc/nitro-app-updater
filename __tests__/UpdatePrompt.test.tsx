import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { UpdatePrompt } from '../src/UpdatePrompt'

// Mock the hook if needed, but we are passing externalUpdater so we might not need to mock the module
// but UpdatePrompt imports useAppUpdater so we should probably mock it to avoid issues
jest.mock('../src/useAppUpdater', () => ({
  useAppUpdater: jest.fn(),
}))

describe('UpdatePrompt', () => {
  const mockStartUpdate = jest.fn()
  const mockCompleteUpdate = jest.fn()
  const mockShowHappinessGate = false
  const mockHandleHappinessPositive = jest.fn()
  const mockHandleHappinessNegative = jest.fn()
  const mockHandleHappinessDismiss = jest.fn()

  const defaultUpdaterState = {
    available: true,
    critical: false,
    version: '1.2.3',
    versionCode: '123',
    releaseNotes: undefined,
    trackViewUrl: undefined,
    loading: false,
    
    downloadProgress: { percent: 0, bytesDownloaded: 0, totalBytes: 0 },
    isDownloadComplete: false,
    isReadyToInstall: false,
    isDownloading: false,
    
    startUpdate: mockStartUpdate,
    completeUpdate: mockCompleteUpdate,
    
    showHappinessGate: mockShowHappinessGate,
    handleHappinessPositive: mockHandleHappinessPositive,
    handleHappinessNegative: mockHandleHappinessNegative,
    handleHappinessDismiss: mockHandleHappinessDismiss,
    
    // Add missing properties
    lastReviewPromptDate: 0,
    canRequestReview: false,
    checkUpdate: jest.fn(),
    recordWin: jest.fn(),
    requestReview: jest.fn(),
    openStoreReviewPage: jest.fn(),
    smartReviewState: { winCount: 0, lastPromptDate: 0, hasCompletedReview: false, promptCount: 0 },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing when update is not available', () => {
    const updater = { ...defaultUpdaterState, available: false }
    const { queryByText } = render(
      <UpdatePrompt externalUpdater={updater} />
    )
    expect(queryByText(/Update Available/i)).toBeNull()
  })

  it('renders update prompt when available', () => {
    const { getByText } = render(
      <UpdatePrompt externalUpdater={defaultUpdaterState} />
    )
    expect(getByText('Update Available')).toBeTruthy()
  })

  it('shows critical update UI when critical', () => {
    // Note: The UI for critical updates might just remove the dismiss button or change text
    // Based on code: 
    // {!critical && ( ... dismiss button ... )}
    // So distinct UI is absence of "Later" button
    
    const updater = { ...defaultUpdaterState, critical: true }
    const { queryByText, getByText } = render(
      <UpdatePrompt externalUpdater={updater} cancelText="Later" />
    )
    expect(getByText('Update Available')).toBeTruthy() 
    expect(queryByText('Later')).toBeNull()
  })

  it('calls startUpdate when Update Now is pressed', () => {
    const { getByText } = render(
      <UpdatePrompt externalUpdater={defaultUpdaterState} confirmText="Update Now" />
    )
    fireEvent.press(getByText('Update Now'))
    expect(mockStartUpdate).toHaveBeenCalledTimes(1)
  })

  it('shows install button when ready to install', () => {
    const updater = { ...defaultUpdaterState, isReadyToInstall: true }
    const { getByText } = render(
      <UpdatePrompt externalUpdater={updater} />
    )
    expect(getByText('Install & Restart')).toBeTruthy()
  })

  it('calls completeUpdate when Install button is pressed', () => {
    const updater = { ...defaultUpdaterState, isReadyToInstall: true }
    const { getByText } = render(
      <UpdatePrompt externalUpdater={updater} />
    )
    fireEvent.press(getByText('Install & Restart'))
    expect(mockCompleteUpdate).toHaveBeenCalledTimes(1)
  })

  it('shows progress bar and hides buttons when downloading', () => {
    const updater = { ...defaultUpdaterState, isDownloading: true, confirmText: 'Update Now', cancelText: 'Later' }
    const { getByText, queryByText } = render(
      <UpdatePrompt externalUpdater={updater} confirmText="Update Now" cancelText="Later" />
    )
    
    expect(getByText('Downloading update...')).toBeTruthy()
    expect(queryByText('Update Now')).toBeNull()
    expect(queryByText('Later')).toBeNull()
  })
})
