import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Platform } from 'react-native';
import { useAppUpdater, UpdatePrompt, type AppUpdaterEvent } from '@minhnc/nitro-app-updater';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [debugMode, setDebugMode] = useState(true); // Default to true for easy emulator testing

  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev.slice(0, 19)]);
    console.log(`[Example] ${message}`);
  };

  const handleEvent = (event: AppUpdaterEvent) => {
    addLog(`${event.type}: ${JSON.stringify(event.payload)}`);
  };

  const updater = useAppUpdater({
    debugMode: debugMode,
    checkOnMount: false,
    reviewCooldownDays: debugMode ? 0 : 120,
    onEvent: handleEvent,
    iosStoreId: '6514638249',
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
              <View style={[styles.badge, { backgroundColor: isAvailable ? '#E6FFFA' : '#FFF5F5' }]}>
                <Text style={[styles.badgeText, { color: isAvailable ? '#38A169' : '#E53E3E' }]}>
                  {isAvailable ? 'YES' : 'NO'}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Review Ready</Text>
              <View style={[styles.badge, { backgroundColor: canRequestReview ? '#E6FFFA' : '#FFF5F5' }]}>
                <Text style={[styles.badgeText, { color: canRequestReview ? '#38A169' : '#E53E3E' }]}>
                  {canRequestReview ? 'READY' : 'COOLDOWN'}
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
              <Text style={styles.progressTitle}>Downloading Update...</Text>
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
                <TouchableOpacity style={styles.primaryButton} onPress={() => startUpdate()}>
                  <Text style={styles.buttonText}>Start Download</Text>
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
          iosStoreId: '6514638249',
          minOsVersion: '13.0'
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '600',
  },
  statusDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  metaValue: {
    color: '#0F172A',
    fontWeight: '600',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
  },
  activeButton: {
    backgroundColor: '#3B82F6',
  },
  activeButtonText: {
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  pillButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
  },
  storeButton: {
    backgroundColor: '#10B981',
  },
  disabledButton: {
    backgroundColor: '#CBD5E1',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  winButton: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  winButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  winButtonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  indicatorContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
  },
  indicatorText: {
    color: '#047857',
    fontWeight: '700',
    fontSize: 13,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  progressInfo: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  installButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logContainer: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 16,
    minHeight: 180,
  },
  logText: {
    color: '#94A3B8',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 11,
    marginBottom: 6,
  },
  emptyLog: {
    color: '#475569',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 60,
    fontSize: 13,
  }
});
