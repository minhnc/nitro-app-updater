import React from 'react'
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, SafeAreaView } from 'react-native'
import { useAppUpdater } from './useAppUpdater'
import type { AppUpdaterEvent } from './types'
import { HappinessGate } from './HappinessGate'

const MIN_PROGRESS_WIDTH = 5

export interface UpdatePromptTheme {
  primary?: string
  background?: string
  text?: string
  subtext?: string
  overlay?: string
  error?: string
}

export interface UpdatePromptProps {
  /**
   * Configuration for the updater hook.
   */
  config?: Parameters<typeof useAppUpdater>[0]
  /**
   * Custom title text (default: "Update Available")
   */
  title?: string
  /**
   * Custom message (default: "A new version of the app is available. Please update to continue.")
   */
  message?: string
  /**
   * Primary button text (default: "Update Now")
   */
  confirmText?: string
  /**
   * Secondary button text (default: "Later")
   */
  cancelText?: string
  /**
   * Custom theme colors
   */
  theme?: UpdatePromptTheme
  /**
   * Happiness Gate customization for localization or brand voice.
   */
  happinessGate?: {
    title?: string
    positiveText?: string
    negativeText?: string
    dismissText?: string
  }
  /**
   * Unified event callback for analytics/logging.
   */
  onEvent?: (event: AppUpdaterEvent) => void
  /**
   * Optional: Provide an external updater state (result of useAppUpdater hook).
   * If provided, the prompt will use this state instead of creating its own.
   */
  externalUpdater?: ReturnType<typeof useAppUpdater>

  // Localization / Text Overrides
  downloadingText?: string
  installText?: string
  whatsNewLabel?: string
  errorTitle?: string
  errorRetryText?: string
}

export const UpdatePrompt = React.memo(function UpdatePrompt(props: UpdatePromptProps) {
  if (props.externalUpdater) {
    return <UpdatePromptView updater={props.externalUpdater} {...props} />
  }
  return <InternalUpdatePrompt {...props} />
})

const InternalUpdatePrompt = React.memo(function InternalUpdatePrompt(
  props: Omit<UpdatePromptProps, 'externalUpdater'>
) {
  const mergedConfig = {
    iosStoreId: '' as const,
    ...props.config,
    onEvent: props.onEvent || props.config?.onEvent
  }
  const updater = useAppUpdater(mergedConfig)
  
  return <UpdatePromptView updater={updater} {...props} />
})

type UpdatePromptViewProps = Omit<UpdatePromptProps, 'externalUpdater'> & {
  updater: ReturnType<typeof useAppUpdater>
}

const UpdatePromptView = React.memo(function UpdatePromptView({ 
  updater,
  title = "Update Available", 
  message = "A new version is available! Upgrade now for the latest features and fixes.",
  confirmText = "Update Now",
  cancelText = "Later",
  theme,
  happinessGate,
  downloadingText = "Downloading update...",
  installText = "Install & Restart",
  whatsNewLabel = "What's New:",
  errorTitle = "Update Failed",
  errorRetryText = "Try Again"
}: UpdatePromptViewProps) {
  const { 
    available, 
    critical, 
    releaseNotes, 
    downloadProgress,
    startUpdate, 
    isReadyToInstall, 
    isDownloading,
    completeUpdate,
    // Smart Review
    showHappinessGate,
    handleHappinessPositive,
    handleHappinessNegative,
    handleHappinessDismiss,
    error: updaterError,
    checkUpdate,
  } = updater
  
  const [dismissed, setDismissed] = React.useState(false)
  const fadeAnim = React.useRef(new Animated.Value(0)).current // Initial value for opacity: 0
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current // Initial scale
  const [retryFlash, setRetryFlash] = React.useState(false)
  const retryTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const isMountedRef = React.useRef(true)
  // Cleanup timeout on unmount
  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

  const colors = {
    primary: theme?.primary || '#007AFF',
    background: theme?.background || 'rgba(255, 255, 255, 0.95)',
    text: theme?.text || '#000000',
    subtext: theme?.subtext || '#666666',
    overlay: theme?.overlay || 'rgba(0, 0, 0, 0.5)',
    error: theme?.error || '#FF3B30'
  }

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
        if (!isMountedRef.current) return
        setDismissed(true)
        updater.emitEvent({ type: 'update_dismissed', payload: {} })
    })
  }

  const handleRetry = () => {
    setRetryFlash(true)
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    retryTimeoutRef.current = setTimeout(() => setRetryFlash(false), 500)
    if (!available) {
      checkUpdate(true).catch(() => {})
    } else {
      startUpdate().catch(() => {})
    }
  }

  const prevVersionRef = React.useRef(updater.version)

  React.useEffect(() => {
    if (available && !dismissed) {
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.95)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start()
      prevVersionRef.current = updater.version
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, dismissed, updater.version])

  // Reset prompt visibility if a NEW update version is found after a previous dismissal
  React.useEffect(() => {
    if (available && dismissed && updater.version !== prevVersionRef.current) {
        setDismissed(false)
        prevVersionRef.current = updater.version
    }
  }, [available, dismissed, updater.version])

  const showUpdateModal = available && !dismissed

  return (
    <>
      {showHappinessGate && (
        <HappinessGate
          visible={showHappinessGate}
          title={happinessGate?.title}
          positiveText={happinessGate?.positiveText}
          negativeText={happinessGate?.negativeText}
          dismissText={happinessGate?.dismissText}
          onPositive={handleHappinessPositive}
          onNegative={handleHappinessNegative}
          onDismiss={handleHappinessDismiss}
          theme={theme}
        />
      )}

      {showUpdateModal && (
        <Modal transparent animationType="none" visible={showUpdateModal}>
          <Animated.View style={[styles.container, { backgroundColor: colors.overlay, opacity: fadeAnim }]}>
            <Animated.View 
              style={[
                styles.card, 
                { 
                  backgroundColor: colors.background,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
              accessible={true}
              accessibilityRole="alert"
              accessibilityLabel={`${title}. ${message}`}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              </View>
              
              <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.message, { color: colors.subtext }]}>{message}</Text>
                
                {releaseNotes ? (
                  <View style={styles.notesContainer}>
                    <Text style={[styles.notesTitle, { color: colors.text }]}>{whatsNewLabel}</Text>
                    <Text style={[styles.notesText, { color: colors.subtext }]}>{releaseNotes}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <SafeAreaView style={styles.footer}>
                {isDownloading ? (
                  <View 
                    style={styles.progressContainer}
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`${downloadingText} ${Math.round(downloadProgress.percent)}%`}
                  >
                    <Text style={[styles.downloadingText, { color: colors.text }]}>{downloadingText}</Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.max(MIN_PROGRESS_WIDTH, downloadProgress.percent)}%`, backgroundColor: colors.primary }]} />
                    </View>
                    <Text style={[styles.progressText, { color: colors.subtext }]}>{Math.round(downloadProgress.percent)}%</Text>
                  </View>
                ) : updaterError ? (
                  <View style={[styles.errorContainer, { borderColor: `rgba(${hexToRgb(colors.error)}, 0.1)`, backgroundColor: `rgba(${hexToRgb(colors.error)}, 0.05)` }, retryFlash && { backgroundColor: `rgba(${hexToRgb(colors.error)}, 0.15)` }]}>
                    <Text style={[styles.errorTitle, { color: colors.error }]}>{errorTitle}</Text>
                    <Text style={[styles.errorMessage, { color: colors.subtext }]}>
                      {updaterError.message || 'An unexpected error occurred.'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.button, styles.primaryButton, styles.errorRetryButton, { backgroundColor: colors.primary }]}
                      onPress={handleRetry}
                      testID="update-prompt-retry-button"
                      activeOpacity={0.8}
                    >
                      <Text style={styles.primaryButtonText}>{errorRetryText}</Text>
                    </TouchableOpacity>
                  </View>
                ) : isReadyToInstall ? (
                  <TouchableOpacity 
                    testID="update-prompt-install-button"
                    style={[styles.button, styles.installButton, { backgroundColor: colors.primary }]}
                    onPress={completeUpdate}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={installText}
                    accessibilityHint="Installs the downloaded update and restarts the app immediately."
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.primaryButtonText}>{installText}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity 
                      testID="update-prompt-confirm-button"
                      style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
                      onPress={startUpdate}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={confirmText}
                      accessibilityHint="Downloads and installs the new version from the store."
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.primaryButtonText}>{confirmText}</Text>
                    </TouchableOpacity>
                    
                    {!critical && (
                      <TouchableOpacity 
                        style={[styles.button, styles.secondaryButton]}
                        onPress={handleDismiss}
                        testID="update-prompt-cancel-button"
                        accessibilityRole="button"
                        accessibilityLabel={cancelText}
                        accessibilityHint="Dismisses the update prompt for now."
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{cancelText}</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </SafeAreaView>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </>
  )
})

/**
 * Helper to convert hex to RGB for alpha extraction.
 * Supports 3 and 6 digit hex strings with or without #.
 * Returns "255, 59, 48" (default error red) for invalid input.
 */
function hexToRgb(hex: string): string {
  // Validate hex format
  const hexRegex = /^#?([A-Fa-f0-9]{3}){1,2}$/
  if (!hexRegex.test(hex)) {
    return '255, 59, 48' // Default fallback red
  }

  let cleanHex = hex.replace('#', '')
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('')
  }
  
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  
  return `${r}, ${g}, ${b}`
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  header: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  content: {
    maxHeight: 320,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  message: {
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    fontWeight: '500',
  },
  notesContainer: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  button: {
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButton: {
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  installButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    height: 48,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressContainer: {
    marginVertical: 12,
    gap: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  downloadingText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  errorRetryButton: {
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  }
});
