/**
 * Recordings Page - List and sync device recordings
 */

import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {Stack, router} from 'expo-router';

import {
  BotaClient,
  type DeviceRecording,
  type SyncProgress,
} from '@bota/react-native-sdk';
import {useBota} from '../src/context/BotaContext';
import {getUploadInfo} from '../src/api/backend';

interface RecordingWithProgress extends DeviceRecording {
  syncProgress?: SyncProgress;
  isSyncing?: boolean;
  isSynced?: boolean;
}

export default function RecordingsScreen() {
  const {connectedDevice} = useBota();
  const device = connectedDevice;

  const [recordings, setRecordings] = useState<RecordingWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    if (!device) {
      router.replace('/home');
      return;
    }
    loadRecordings();
  }, [device]);

  async function loadRecordings() {
    if (!device) return;
    try {
      const list = await BotaClient.recordings.listRecordings(device);
      setRecordings(list.map(r => ({...r, isSynced: false})));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load recordings';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecordings();
    setRefreshing(false);
  }, [device]);

  async function syncRecording(recording: RecordingWithProgress) {
    if (!device || recording.isSyncing || recording.isSynced) return;

    // Mark as syncing
    setRecordings(prev =>
      prev.map(r =>
        r.id === recording.id ? {...r, isSyncing: true} : r,
      ),
    );

    try {
      // Get upload info from backend
      const uploadInfo = await getUploadInfo(recording.id, device.serialNumber);

      // Start sync with progress tracking
      for await (const progress of BotaClient.recordings.syncRecording(
        device,
        recording,
        uploadInfo,
      )) {
        setRecordings(prev =>
          prev.map(r =>
            r.id === recording.id ? {...r, syncProgress: progress} : r,
          ),
        );
      }

      // Mark as synced
      setRecordings(prev =>
        prev.map(r =>
          r.id === recording.id
            ? {...r, isSyncing: false, isSynced: true, syncProgress: undefined}
            : r,
        ),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sync failed';
      Alert.alert('Sync Error', message);

      // Reset syncing state
      setRecordings(prev =>
        prev.map(r =>
          r.id === recording.id
            ? {...r, isSyncing: false, syncProgress: undefined}
            : r,
        ),
      );
    }
  }

  async function syncAllRecordings() {
    if (!device || syncingAll) return;

    const unsyncedRecordings = recordings.filter(
      r => !r.isSynced && !r.isSyncing,
    );

    if (unsyncedRecordings.length === 0) {
      Alert.alert('All Synced', 'All recordings have been synced.');
      return;
    }

    setSyncingAll(true);

    try {
      // Provide upload info for each recording
      const uploadInfoProvider = async (recordingId: string) => {
        return getUploadInfo(recordingId, device.serialNumber);
      };

      // Sync all recordings
      for await (const progress of BotaClient.recordings.syncAllRecordings(
        device,
        uploadInfoProvider,
      )) {
        // Update progress for the current recording
        setRecordings(prev =>
          prev.map(r =>
            r.id === progress.recordingId
              ? {
                  ...r,
                  isSyncing: progress.stage !== 'completed',
                  isSynced: progress.stage === 'completed',
                  syncProgress: progress,
                }
              : r,
          ),
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sync failed';
      Alert.alert('Sync Error', message);
    } finally {
      setSyncingAll(false);
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatFileSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function getProgressText(progress: SyncProgress): string {
    switch (progress.stage) {
      case 'transferring':
        return `Transferring ${Math.round(progress.progress * 100)}%`;
      case 'uploading':
        return `Uploading ${Math.round(progress.progress * 100)}%`;
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Processing...';
    }
  }

  function renderRecording({item}: {item: RecordingWithProgress}) {
    return (
      <TouchableOpacity
        style={[styles.recordingCard, item.isSynced && styles.recordingSynced]}
        onPress={() => syncRecording(item)}
        disabled={item.isSyncing || item.isSynced}>
        <View style={styles.recordingInfo}>
          <Text style={styles.recordingDate}>{formatDate(item.timestamp)}</Text>
          <View style={styles.recordingMeta}>
            <Text style={styles.metaText}>
              {formatDuration(item.duration)}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{formatFileSize(item.size)}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{item.codec.toUpperCase()}</Text>
          </View>

          {/* Progress indicator */}
          {item.isSyncing && item.syncProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {width: `${item.syncProgress.progress * 100}%`},
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {getProgressText(item.syncProgress)}
              </Text>
            </View>
          )}

          {/* Synced indicator */}
          {item.isSynced && (
            <Text style={styles.syncedText}>Synced</Text>
          )}
        </View>

        {/* Action indicator */}
        {item.isSyncing ? (
          <ActivityIndicator color="#007AFF" />
        ) : item.isSynced ? (
          <Text style={styles.checkmark}>✓</Text>
        ) : (
          <Text style={styles.syncIcon}>↑</Text>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{title: 'Recordings'}} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading recordings...</Text>
        </View>
      </>
    );
  }

  const unsyncedCount = recordings.filter(r => !r.isSynced && !r.isSyncing).length;

  return (
    <>
      <Stack.Screen options={{title: 'Recordings'}} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {recordings.length} Recording{recordings.length !== 1 ? 's' : ''}
          </Text>
          {unsyncedCount > 0 && (
            <TouchableOpacity
              style={[styles.syncAllButton, syncingAll && styles.syncAllDisabled]}
              onPress={syncAllRecordings}
              disabled={syncingAll}>
              {syncingAll ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.syncAllText}>Sync All ({unsyncedCount})</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Recording list */}
        {recordings.length > 0 ? (
          <FlatList
            data={recordings}
            keyExtractor={item => item.id}
            renderItem={renderRecording}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Recordings</Text>
            <Text style={styles.emptyText}>
              This device has no recordings to sync.
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  syncAllButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  syncAllDisabled: {
    opacity: 0.6,
  },
  syncAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  recordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordingSynced: {
    backgroundColor: '#F0FFF4',
  },
  recordingInfo: {
    flex: 1,
  },
  recordingDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  recordingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  metaDot: {
    marginHorizontal: 6,
    color: '#999',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#007AFF',
  },
  syncedText: {
    marginTop: 4,
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  syncIcon: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#34C759',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
