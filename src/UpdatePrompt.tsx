import React from 'react'
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native'
import { useAppUpdater, type AppUpdaterEvent } from './useAppUpdater'
import { AppUpdaterError, AppUpdaterErrorCode } from './AppUpdaterError'
import { HappinessGate } from './HappinessGate'

const MIN_PROGRESS_WIDTH = 5

export interface UpdatePromptTheme {
  primary?: string
  background?: string
  text?: string
  subtext?: string
  overlay?: string
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
}

export const UpdatePrompt = React.memo(function UpdatePrompt({ 
  config, 
  title = "Update Available", 
  message = "A new version is available! Upgrade now for the latest features and fixes.",
  confirmText = "Update Now",
  cancelText = "Later",
  theme,
  happinessGate,
  onEvent,
  externalUpdater
}: UpdatePromptProps) {
  // Optimization: Do not call the internal hook if an external one is already provided
  // We use a dummy state to satisfy hook rules if external is provided, but since useAppUpdater 
  // is a custom hook we should be careful. Actually, it's better to just ensure useAppUpdater 
  // is fast or refactor so the logic can be shared. 
  // Given standard React rules, we MUST call the hook if it's there, but we can make it do nothing.
  const internalUpdater = useAppUpdater({
    ...config,
    onEvent,
    enabled: !externalUpdater,
    checkOnMount: externalUpdater ? false : config?.checkOnMount
  })

  const updater = externalUpdater || internalUpdater
  
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
  } = updater
  const [dismissed, setDismissed] = React.useState(false)
  const fadeAnim = React.useRef(new Animated.Value(0)).current // Initial value for opacity: 0
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current // Initial scale

  const colors = {
    primary: theme?.primary || '#007AFF',
    background: theme?.background || 'rgba(255, 255, 255, 0.95)',
    text: theme?.text || '#000000',
    subtext: theme?.subtext || '#666666',
    overlay: theme?.overlay || 'rgba(0, 0, 0, 0.5)'
  }

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
        setDismissed(true)
        onEvent?.({
          type: 'update_dismissed',
          payload: { error: new AppUpdaterError(AppUpdaterErrorCode.USER_CANCELLED, "User dismissed the update prompt") }
        })
    })
  }

  React.useEffect(() => {
    if (available && !dismissed) {
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
    }
  }, [available, dismissed, fadeAnim, scaleAnim])

  const showUpdateModal = available && !dismissed

  return (
    <>
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
                  <Text style={[styles.notesTitle, { color: colors.text }]}>What's New:</Text>
                  <Text style={[styles.notesText, { color: colors.subtext }]}>{releaseNotes}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              {isDownloading ? (
                <View 
                  style={styles.progressContainer}
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={`Downloading update: ${Math.round(downloadProgress.percent)}%`}
                >
                  <Text style={[styles.downloadingText, { color: colors.text }]}>Downloading update...</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${Math.max(MIN_PROGRESS_WIDTH, downloadProgress.percent)}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={[styles.progressText, { color: colors.subtext }]}>{Math.round(downloadProgress.percent)}%</Text>
                </View>
              ) : isReadyToInstall ? (
                <TouchableOpacity 
                  style={[styles.button, styles.installButton, { backgroundColor: colors.primary }]}
                  onPress={completeUpdate}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Install and restart application"
                  accessibilityHint="Installs the downloaded update and restarts the app immediately."
                >
                  <Text style={styles.primaryButtonText}>Install & Restart</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity 
                    style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
                    onPress={startUpdate}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={confirmText}
                    accessibilityHint="Downloads and installs the new version from the store."
                  >
                    <Text style={styles.primaryButtonText}>{confirmText}</Text>
                  </TouchableOpacity>
                  
                  {!critical && (
                    <TouchableOpacity 
                      style={[styles.button, styles.secondaryButton]}
                      onPress={handleDismiss}
                      accessibilityRole="button"
                      accessibilityLabel={cancelText}
                      accessibilityHint="Dismisses the update prompt for now."
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{cancelText}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  )
})

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
    padding: 24,
    paddingTop: 12,
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
});
