/**
 * Debug Panel Component
 *
 * Provides a comprehensive debugging interface for the JASB app.
 * Only shown in development mode and can be toggled on/off.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { logger, LogLevel, LogCategory, type LogEntry } from '../lib/logger';

interface DebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel>(LogLevel.DEBUG);
  const [filterCategory, setFilterCategory] = useState<LogCategory | 'ALL'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const refreshLogs = () => {
    setRefreshing(true);
    const filteredLogs = logger.getLogs({
      level: filterLevel,
      category: filterCategory === 'ALL' ? undefined : filterCategory,
      limit: 100,
    });
    setLogs(filteredLogs.reverse()); // Show newest first
    setRefreshing(false);
  };

  useEffect(() => {
    if (visible) {
      refreshLogs();
    }
  }, [visible, filterLevel, filterCategory]);

  const getLogLevelColor = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.ERROR:
        return '#ef4444'; // red-500
      case LogLevel.WARN:
        return '#f59e0b'; // amber-500
      case LogLevel.INFO:
        return '#3b82f6'; // blue-500
      case LogLevel.DEBUG:
        return '#6b7280'; // gray-500
      case LogLevel.TRACE:
        return '#9ca3af'; // gray-400
      default:
        return '#6b7280';
    }
  };

  const getCategoryColor = (category: LogCategory): string => {
    const colors = {
      [LogCategory.NETWORK]: '#10b981', // green-500
      [LogCategory.AUTH]: '#8b5cf6', // violet-500
      [LogCategory.NAVIGATION]: '#06b6d4', // cyan-500
      [LogCategory.UI]: '#f59e0b', // amber-500
      [LogCategory.API]: '#3b82f6', // blue-500
      [LogCategory.STORAGE]: '#84cc16', // lime-500
      [LogCategory.PERFORMANCE]: '#f97316', // orange-500
      [LogCategory.ERROR]: '#ef4444', // red-500
      [LogCategory.USER_ACTION]: '#ec4899', // pink-500
    };
    return colors[category] || '#6b7280';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const exportLogs = async () => {
    try {
      const errorSummary = logger.getErrorSummary();
      const logsText = `JASB Debug Logs Export
Generated: ${new Date().toISOString()}

Error Summary (Last 10 minutes):
- Total Errors: ${errorSummary.totalErrors}
- By Category: ${JSON.stringify(errorSummary.categories, null, 2)}

Recent Logs:
${logger.exportLogs('text')}
`;

      await Share.share({
        message: logsText,
        title: 'JASB Debug Logs',
      });
    } catch (error) {
      Alert.alert('Export Failed', 'Could not export logs');
    }
  };

  const clearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            logger.clearLogs();
            refreshLogs();
          },
        },
      ]
    );
  };

  const renderLogEntry = (log: LogEntry, index: number) => (
    <View key={index} className="border-b border-gray-200 p-3">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center">
          <View
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: getLogLevelColor(log.level) }}
          />
          <Text className="text-xs text-gray-500">
            {formatTimestamp(log.timestamp)}
          </Text>
        </View>
        <View
          className="px-2 py-1 rounded"
          style={{ backgroundColor: getCategoryColor(log.category) + '20' }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: getCategoryColor(log.category) }}
          >
            {log.category}
          </Text>
        </View>
      </View>

      <Text className="font-medium mb-1">{log.message}</Text>

      {log.data && (
        <View className="bg-gray-100 p-2 rounded mt-1">
          <Text className="text-xs text-gray-700">
            {JSON.stringify(log.data, null, 2)}
          </Text>
        </View>
      )}

      {log.error && (
        <View className="bg-red-100 p-2 rounded mt-1">
          <Text className="text-xs text-red-700">
            {log.error.message}
          </Text>
          {log.error.stack && (
            <Text className="text-xs text-red-600 mt-1">
              {log.error.stack}
            </Text>
          )}
        </View>
      )}

      {log.context && (
        <View className="bg-blue-100 p-2 rounded mt-1">
          <Text className="text-xs text-blue-700">
            Context: {JSON.stringify(log.context, null, 2)}
          </Text>
        </View>
      )}
    </View>
  );

  const errorSummary = logger.getErrorSummary();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-gray-900 p-4 pt-12">
          <View className="flex-row items-center justify-between">
            <Text className="text-white font-bold text-lg">Debug Panel</Text>
            <TouchableOpacity onPress={onClose} className="px-4 py-2">
              <Text className="text-white font-medium">Close</Text>
            </TouchableOpacity>
          </View>

          {/* Error Summary */}
          {errorSummary.totalErrors > 0 && (
            <View className="bg-red-500 rounded p-3 mt-3">
              <Text className="text-white font-medium">
                {errorSummary.totalErrors} errors in last 10 minutes
              </Text>
              <Text className="text-red-100 text-sm">
                Network: {errorSummary.categories.NETWORK}, Auth: {errorSummary.categories.AUTH}
              </Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View className="bg-gray-100 p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-medium">Filters:</Text>
            <View className="flex-row space-x-2">
              <TouchableOpacity
                onPress={exportLogs}
                className="bg-blue-500 px-3 py-1 rounded"
              >
                <Text className="text-white text-sm">Export</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearLogs}
                className="bg-red-500 px-3 py-1 rounded"
              >
                <Text className="text-white text-sm">Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Level Filter */}
          <View className="mb-3">
            <Text className="text-sm text-gray-600 mb-1">Log Level:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row space-x-2">
                {Object.values(LogLevel).map((level) => (
                  <TouchableOpacity
                    key={level}
                    onPress={() => setFilterLevel(level)}
                    className={`px-3 py-1 rounded ${
                      filterLevel === level ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        filterLevel === level ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Category Filter */}
          <View>
            <Text className="text-sm text-gray-600 mb-1">Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={() => setFilterCategory('ALL')}
                  className={`px-3 py-1 rounded ${
                    filterCategory === 'ALL' ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      filterCategory === 'ALL' ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    ALL
                  </Text>
                </TouchableOpacity>
                {Object.values(LogCategory).map((category) => (
                  <TouchableOpacity
                    key={category}
                    onPress={() => setFilterCategory(category)}
                    className={`px-3 py-1 rounded ${
                      filterCategory === category ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        filterCategory === category ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Logs List */}
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshLogs} />
          }
        >
          {logs.length === 0 ? (
            <View className="flex-1 justify-center items-center p-8">
              <Text className="text-gray-500 text-center">
                No logs found for the current filters.
              </Text>
              <TouchableOpacity
                onPress={refreshLogs}
                className="bg-blue-500 px-4 py-2 rounded mt-4"
              >
                <Text className="text-white">Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            logs.map(renderLogEntry)
          )}
        </ScrollView>

        {/* Footer */}
        <View className="bg-gray-100 p-4">
          <Text className="text-center text-gray-500 text-sm">
            {logs.length} logs displayed • {errorSummary.totalErrors} recent errors
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// Quick Debug Button - FloatingActionButton style
export const DebugButton: React.FC = () => {
  const [showPanel, setShowPanel] = useState(false);

  // Only show in development
  if (!__DEV__) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowPanel(true)}
        className="absolute bottom-4 right-4 bg-red-500 w-12 h-12 rounded-full items-center justify-center shadow-lg z-50"
        style={{ elevation: 8 }}
      >
        <Text className="text-white font-bold">🐛</Text>
      </TouchableOpacity>

      <DebugPanel visible={showPanel} onClose={() => setShowPanel(false)} />
    </>
  );
};

export default DebugPanel;