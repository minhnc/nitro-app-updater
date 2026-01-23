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

export const HappinessGate = React.memo(function HappinessGate({
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
          accessibilityLabel={title}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.choiceContainer}>
              <TouchableOpacity
                style={[styles.choiceButton, styles.positiveButton, { backgroundColor: colors.primary }]}
                onPress={() => handleAction(onPositive)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={positiveText}
              >
                <Text style={styles.positiveButtonText}>{positiveText}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.choiceButton, styles.negativeButton, { borderColor: colors.primary, borderWidth: 1 }]}
                onPress={() => handleAction(onNegative)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={negativeText}
              >
                <Text style={[styles.negativeButtonText, { color: colors.primary }]}>{negativeText}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => handleAction(onDismiss)}
              accessibilityRole="button"
              accessibilityLabel={dismissText}
            >
              <Text style={[styles.dismissButtonText, { color: colors.subtext }]}>{dismissText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
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
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 15,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  header: {
    paddingBottom: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  footer: {
    gap: 16,
  },
  choiceContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  choiceButton: {
    flex: 1,
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
  positiveButton: {
    // Standard shadow from choiceButton
  },
  positiveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  negativeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  negativeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
