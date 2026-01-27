import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Platform } from 'react-native';
import { useAppUpdater, UpdatePrompt, type AppUpdaterEvent, type UpdatePromptTheme } from '@minhnc/nitro-app-updater';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [debugMode, setDebugMode] = useState(true); // Default to true for easy emulator testing

  // Example of type-safe theming with the new UpdatePromptTheme interface
  const customTheme: UpdatePromptTheme = {
    primary: '#2563EB',
    background: 'rgba(255, 255, 255, 0.98)',
    text: '#1E293B',
    subtext: '#64748B',
    overlay: 'rgba(15, 23, 42, 0.6)',
  };

  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev.slice(0, 19)]);
  };

  const handleEvent = (event: AppUpdaterEvent) => {
    addLog(`${event.type}: ${JSON.stringify(event.payload)}`);
  };

  const updater = useAppUpdater({
    debugMode: debugMode,
    checkOnMount: false,
    reviewCooldownDays: debugMode ? 0 : 120,
    onEvent: handleEvent,
    iosStoreId: '6514638249', // Replace with your numeric App Store ID (required for iOS manual review links)
    minOsVersion: '13.0',
    smartReview: {
      enabled: true,
      cooldownDays: debugMode ? 0 : 120,
      winsBeforePrompt: 3,
      onNegativeFeedback: () => {
        addLog('Negative feedback recorded internally');
      }
    },
    onDownloadComplete: () => {
      addLog('Update download finished!');
    }
  });

  const {
    available,
    versionCode,
    downloadProgress,
    checkUpdate,
    startUpdate,
    completeUpdate,
    isReadyToInstall,
    isDownloading,
    requestReview,
    openStoreReviewPage,
    canRequestReview,
    lastReviewPromptDate,
    recordWin,
    showHappinessGate
  } = updater;

  // Derive display states
  const isAvailable = available;
  const displayProgress = downloadProgress;
  const isInstallable = isReadyToInstall;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>Nitro App Updater</Text>
        <Text style={styles.subtitle}>Native JSI In-App Updates</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Library Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Update Available</Text>
              <View style={[styles.badge, isAvailable ? styles.badgeSuccess : styles.badgeError]}>
                <Text style={[styles.badgeText, isAvailable ? styles.textSuccess : styles.textError]}>
                  {isAvailable ? 'YES' : 'NO'}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Review Ready</Text>
              <View style={[styles.badge, canRequestReview ? styles.badgeSuccess : styles.badgeError]}>
                <Text style={[styles.badgeText, canRequestReview ? styles.textSuccess : styles.textError]}>
                  {canRequestReview ? 'READY' : 'COOLDOWN'}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Is Downloading</Text>
              <View style={[styles.badge, isDownloading ? styles.badgeInfo : styles.badgeIdle]}>
                <Text style={[styles.badgeText, isDownloading ? styles.textInfo : styles.textIdle]}>
                  {isDownloading ? 'YES' : 'NO'}
                </Text>
              </View>
            </View>
            <View style={styles.statusDivider} />
            <Text style={styles.metaText}>Version Code: <Text style={styles.metaValue}>{versionCode || '1.0.0'}</Text></Text>
            {lastReviewPromptDate !== undefined && lastReviewPromptDate > 0 && (
              <Text style={styles.metaText}>Last Prompt: <Text style={styles.metaValue}>{new Date(lastReviewPromptDate).toLocaleDateString()}</Text></Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interactive Controls</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => checkUpdate(false)}>
              <Text style={styles.buttonText}>Check Update</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.secondaryButton, isAvailable && styles.activeButton]} 
              onPress={() => checkUpdate(true)} // Set to true to show mock update
            >
              <Text style={[styles.secondaryButtonText, isAvailable && styles.activeButtonText]}>
                {isAvailable ? 'Update Mocked' : 'Mock Update'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.secondaryButton, debugMode && styles.activeButton]} 
              onPress={() => setDebugMode(!debugMode)}
            >
              <Text style={[styles.secondaryButtonText, debugMode && styles.activeButtonText]}>
                {debugMode ? 'Debug: ON' : 'Debug: OFF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.pillButton, !canRequestReview && styles.disabledButton]} 
              onPress={requestReview}
              disabled={!canRequestReview}
            >
              <Text style={styles.buttonText}>Request Review</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.pillButton, styles.storeButton]} onPress={openStoreReviewPage}>
              <Text style={styles.buttonText}>Manual Store Rate</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.winButton} onPress={recordWin}>
            <Text style={styles.winButtonText}>Record Positive Action 🏆</Text>
            <Text style={styles.winButtonSubtext}>Simulate a "user win" for Smart Review</Text>
          </TouchableOpacity>
          
          {showHappinessGate && (
            <View style={styles.indicatorContainer}>
              <Text style={styles.indicatorText}>🎉 Happiness Gate should be visible now!</Text>
            </View>
          )}
        </View>

        {isAvailable && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Download Flow</Text>
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>{isDownloading ? 'Downloading Update...' : 'Update Ready'}</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${displayProgress.percent}%` }]} />
              </View>
              <Text style={styles.progressInfo}>
                {displayProgress.percent}% Complete ({Math.round(displayProgress.bytesDownloaded / 1024)} KB / {Math.round(displayProgress.totalBytes / 1024)} KB)
              </Text>
              
              {isInstallable ? (
                <TouchableOpacity style={styles.installButton} onPress={completeUpdate}>
                  <Text style={styles.buttonText}>Install & Restart App</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                   style={[styles.primaryButton, isDownloading && styles.disabledButton]} 
                   onPress={() => startUpdate()}
                   disabled={isDownloading}
                 >
                   <Text style={[styles.buttonText, isDownloading && styles.disabledButtonText]}>
                     {isDownloading ? 'Downloading...' : 'Start Download'}
                   </Text>
                 </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Logs</Text>
          <View style={styles.logContainer}>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logText}>{`> ${log}`}</Text>
            ))}
            {logs.length === 0 && <Text style={styles.emptyLog}>Waiting for actions...</Text>}
          </View>
        </View>
      </ScrollView>

      {/* Pass the shared updater state to the drop-in UI component */}
      <UpdatePrompt 
        externalUpdater={updater}
        config={{
          minRequiredVersion: '1.0.0', // Users on versions < 1.0.0 will be forced to update
        }}
        theme={customTheme}
        happinessGate={{
          title: "Enjoying the app? 🎉",
          positiveText: "Love it! 😊",
          negativeText: "Not really 😕",
          dismissText: "Maybe Later",
        }}
        onEvent={handleEvent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFF', // Soft, very light blue tint
  },
  header: {
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 17,
    color: '#475569',
    fontWeight: '600',
  },
  statusDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
    marginVertical: 16,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: '#E6FFFA',
  },
  badgeError: {
    backgroundColor: '#FFF5F5',
  },
  badgeInfo: {
    backgroundColor: '#EBF8FF',
  },
  badgeIdle: {
    backgroundColor: '#F7FAFC',
  },
  textSuccess: {
    color: '#38A169',
  },
  textError: {
    color: '#E53E3E',
  },
  textInfo: {
    color: '#3182CE',
  },
  textIdle: {
    color: '#718096',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  metaText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  metaValue: {
    color: '#0F172A',
    fontWeight: '700',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '47%',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '47%',
  },
  activeButton: {
    backgroundColor: '#EBF2FF',
    borderColor: '#2563EB',
  },
  activeButtonText: {
    color: '#2563EB',
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  pillButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '47%',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  storeButton: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  disabledButton: {
    backgroundColor: '#F1F5F9',
    shadowOpacity: 0,
  },
  disabledButtonText: {
    color: '#94A3B8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  winButton: {
    backgroundColor: '#F59E0B',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  winButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  winButtonSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  indicatorContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
  },
  indicatorText: {
    color: '#166534',
    fontWeight: '800',
    fontSize: 14,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 16,
  },
  progressBarBg: {
    height: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  progressInfo: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  installButton: {
    width: '100%',
    backgroundColor: '#7C3AED',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  logContainer: {
    backgroundColor: '#020617',
    padding: 20,
    borderRadius: 24,
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  logText: {
    color: '#64748B',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 18,
  },
  emptyLog: {
    color: '#334155',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
    fontWeight: '500',
  }
});
