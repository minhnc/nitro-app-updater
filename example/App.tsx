import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useAppUpdater, UpdatePrompt, type AppUpdaterEvent } from '@minhnc/nitro-app-updater';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev.slice(0, 19)]);
    console.log(`[Example] ${message}`);
  };

  const handleEvent = (event: AppUpdaterEvent) => {
    addLog(`${event.type}: ${JSON.stringify(event.payload)}`);
  };

  const {
    available,
    versionCode,
    loading,
    downloadProgress,
    checkUpdate,
    startUpdate,
    completeUpdate,
    isReadyToInstall,
    requestReview,
    openStoreReviewPage,
    canRequestReview,
    lastReviewPromptDate
  } = useAppUpdater({
    debugMode: !!process.env.DEBUG, // Example of using env var or toggle
    checkOnMount: false,
    onEvent: handleEvent,
    iosStoreId: '6514638249', // Dummy store ID for testing
    minOsVersion: '13.0',     // Dummy min OS version
    onDownloadComplete: () => {
      addLog('Download Complete! Ready to install.');
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>Nitro App Updater</Text>
        <Text style={styles.subtitle}>Native JSI In-App Updates</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>
              Update Available: <Text style={{ fontWeight: 'bold', color: available ? '#4CAF50' : '#F44336' }}>
                {available ? 'YES' : 'NO'}
              </Text>
            </Text>
            <Text style={styles.statusText}>
              Can Request Review: <Text style={{ fontWeight: 'bold', color: canRequestReview ? '#4CAF50' : '#F44336' }}>
                {canRequestReview ? 'YES' : 'NO'}
              </Text>
            </Text>
            {lastReviewPromptDate && (
              <Text style={styles.statusText}>
                Last Review Date: {new Date(lastReviewPromptDate).toLocaleDateString()}
              </Text>
            )}
            {versionCode && <Text style={styles.statusText}>Version Code: {versionCode}</Text>}
            {loading && <Text style={styles.statusText}>Loading...</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Controls</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={() => checkUpdate(false)}>
              <Text style={styles.buttonText}>Check Update</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.debugButton]} onPress={async () => {
              const state = await checkUpdate(true);
              addLog(`Check Result: ${state.available ? 'Available' : 'None'}`);
            }}>
              <Text style={styles.buttonText}>Check Update (Debug)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, !canRequestReview && { backgroundColor: '#A0AEC0' }]} 
              onPress={requestReview}
              disabled={!canRequestReview}
            >
              <Text style={styles.buttonText}>
                {canRequestReview ? 'Request Review' : 'Review Cooldown'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#E53E3E' }]} 
              onPress={openStoreReviewPage}
            >
              <Text style={styles.buttonText}>Rate on Store (Manual)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {downloadProgress.totalBytes > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Download Progress</Text>
            <View style={styles.statusCard}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${downloadProgress.percent}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {downloadProgress.percent}% ({Math.round(downloadProgress.bytesDownloaded / 1024)} KB / {Math.round(downloadProgress.totalBytes / 1024)} KB)
              </Text>
              {isReadyToInstall && (
                <TouchableOpacity style={[styles.button, { marginTop: 10, backgroundColor: '#4CAF50' }]} onPress={completeUpdate}>
                  <Text style={styles.buttonText}>Install & Restart</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logs</Text>
          <View style={styles.logContainer}>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logText}>{`> ${log}`}</Text>
            ))}
            {logs.length === 0 && <Text style={styles.emptyLog}>No actions yet...</Text>}
          </View>
        </View>
      </ScrollView>

      <UpdatePrompt 
        config={{ 
          debugMode: false, 
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
    backgroundColor: '#F5F7FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A5568',
    marginBottom: 8,
    marginLeft: 4,
  },
  statusCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    fontSize: 16,
    color: '#2D3748',
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    backgroundColor: '#3182CE',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '45%',
    flexGrow: 1,
  },
  debugButton: {
    backgroundColor: '#805AD5',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    backgroundColor: '#1A202C',
    padding: 12,
    borderRadius: 8,
    minHeight: 150,
  },
  logText: {
    color: '#A0AEC0',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  emptyLog: {
    color: '#4A5568',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 60,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3182CE',
  },
  progressText: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'right',
  }
});
