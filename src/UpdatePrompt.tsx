import React from 'react'
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native'
import { useAppUpdater, type AppUpdaterEvent } from './useAppUpdater'
import { AppUpdaterError, AppUpdaterErrorCode } from './AppUpdaterError'

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
  theme?: {
    primary?: string
    background?: string
    text?: string
    subtext?: string
    overlay?: string
  }
  /**
   * Unified event callback for analytics/logging.
   */
  onEvent?: (event: AppUpdaterEvent) => void
}

export function UpdatePrompt({ 
  config, 
  title = "Update Available", 
  message = "A new version is available! Upgrade now for the latest features and fixes.",
  confirmText = "Update Now",
  cancelText = "Later",
  theme,
  onEvent
}: UpdatePromptProps) {
  const { available, critical, releaseNotes, startUpdate, isReadyToInstall, completeUpdate } = useAppUpdater({
    ...config,
    onEvent,
  })
  const [dismissed, setDismissed] = React.useState(false)
  const fadeAnim = React.useRef(new Animated.Value(0)).current // Initial value for opacity: 0
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current // Initial scale

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

  if (!available || dismissed) return null

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

  return (
    <Modal transparent animationType="none" visible={available && !dismissed}>
      <Animated.View style={[styles.container, { backgroundColor: colors.overlay, opacity: fadeAnim }]}>
        <Animated.View style={[
          styles.card, 
          { 
            backgroundColor: colors.background,
            transform: [{ scale: scaleAnim }]
          }
        ]}>
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
            {isReadyToInstall ? (
              <TouchableOpacity 
                style={[styles.button, styles.installButton, { backgroundColor: colors.primary }]}
                onPress={completeUpdate}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Install & Restart</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={startUpdate}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{confirmText}</Text>
              </TouchableOpacity>
            )}
            
            {!critical && (
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]}
                onPress={handleDismiss}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{cancelText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    maxHeight: 300,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  notesContainer: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingTop: 10,
    gap: 10,
  },
  button: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  installButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
    marginTop: 5,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '500',
  },
})
