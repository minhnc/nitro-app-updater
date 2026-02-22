import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native'

export interface HappinessGateTheme {
  primary?: string
  background?: string
  text?: string
  overlay?: string
}

export interface HappinessGateProps {
  visible: boolean
  title?: string
  positiveText?: string
  negativeText?: string
  dismissText?: string
  theme?: HappinessGateTheme
  onPositive: () => void
  onNegative: () => void
  onDismiss: () => void
}

export const HappinessGate = React.memo(function HappinessGate({
  visible,
  title = 'Are you enjoying the app?',
  positiveText = 'Yes, I love it!',
  negativeText = 'Not really',
  dismissText = 'Maybe later',
  theme,
  onPositive,
  onNegative,
  onDismiss,
}: HappinessGateProps) {
  const [isClosing, setIsClosing] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current

  useEffect(() => {
    if (visible) {
      setIsClosing(false)
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
        }),
      ]).start()
    }
  }, [visible, fadeAnim, scaleAnim])

  const colors = {
    primary: theme?.primary || '#007AFF',
    background: theme?.background || '#FFFFFF',
    text: theme?.text || '#1C1C1E',
    overlay: theme?.overlay || 'rgba(0, 0, 0, 0.4)',
  }

  const handleAction = useCallback((action: () => void) => {
    setIsClosing(true)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsClosing(false);
      action();
    });
  }, [fadeAnim, scaleAnim])

  if (!visible && !isClosing) return null

  return (
    <Modal transparent animationType="none" visible={visible || isClosing}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback testID="happiness-gate-overlay" onPress={() => handleAction(onDismiss)}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.overlay, opacity: fadeAnim },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              testID="happiness-gate-positive"
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => handleAction(onPositive)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={positiveText}
            >
              <Text style={styles.buttonText}>{positiveText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="happiness-gate-negative"
              style={[styles.button, styles.secondaryButton]}
              onPress={() => handleAction(onNegative)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={negativeText}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                {negativeText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="happiness-gate-dismiss"
              style={styles.dismissButton}
              onPress={() => handleAction(onDismiss)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={dismissText}
            >
              <Text style={styles.dismissButtonText}>{dismissText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 28,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    marginTop: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
})
