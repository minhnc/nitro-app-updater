import React, { useRef, useEffect } from 'react'
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native'

export interface HappinessGateProps {
  /**
   * Whether the gate is visible.
   */
  visible: boolean
  /**
   * Custom title text (default: "Enjoying the app?")
   */
  title?: string
  /**
   * Positive button text (default: "Yes! 😊")
   */
  positiveText?: string
  /**
   * Negative button text (default: "Not really")
   */
  negativeText?: string
  /**
   * Secondary button text (default: "Maybe Later")
   */
  dismissText?: string
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
   * Callback when user taps the positive button.
   */
  onPositive: () => void
  /**
   * Callback when user taps the negative button.
   */
  onNegative: () => void
  /**
   * Callback when user dismisses the gate.
   */
  onDismiss: () => void
}

export function HappinessGate({
  visible,
  title = "Enjoying the app? 🎉",
  positiveText = "Yes! 😊",
  negativeText = "Not really 😕",
  dismissText = "Maybe Later",
  theme,
  onPositive,
  onNegative,
  onDismiss,
}: HappinessGateProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current

  useEffect(() => {
    if (visible) {
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
    } else {
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.95)
    }
  }, [visible, fadeAnim, scaleAnim])

  if (!visible) return null

  const colors = {
    primary: theme?.primary || '#007AFF',
    background: theme?.background || 'rgba(255, 255, 255, 0.95)',
    text: theme?.text || '#000000',
    subtext: theme?.subtext || '#666666',
    overlay: theme?.overlay || 'rgba(0, 0, 0, 0.5)'
  }

  const handleAction = (action: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      action()
    })
  }

  return (
    <Modal transparent animationType="none" visible={visible}>
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

          <View style={styles.footer}>
            <View style={styles.choiceContainer}>
              <TouchableOpacity
                style={[styles.choiceButton, styles.positiveButton, { backgroundColor: colors.primary }]}
                onPress={() => handleAction(onPositive)}
                activeOpacity={0.8}
              >
                <Text style={styles.positiveButtonText}>{positiveText}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.choiceButton, styles.negativeButton, { borderColor: colors.primary, borderWidth: 1 }]}
                onPress={() => handleAction(onNegative)}
                activeOpacity={0.8}
              >
                <Text style={[styles.negativeButtonText, { color: colors.primary }]}>{negativeText}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => handleAction(onDismiss)}
            >
              <Text style={[styles.dismissButtonText, { color: colors.subtext }]}>{dismissText}</Text>
            </TouchableOpacity>
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
    padding: 20,
  },
  header: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    gap: 15,
  },
  choiceContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positiveButton: {
    // shadow
  },
  positiveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  negativeButton: {
    backgroundColor: 'transparent',
  },
  negativeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
