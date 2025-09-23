import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const ConnectionStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkConnection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        timeout: 5000,
      });

      if (response.ok) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      setIsConnected(false);
    }
    setLastCheck(new Date());
  };

  useEffect(() => {
    checkConnection();

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isConnected === null) {
    return (
      <View className="rounded-lg bg-yellow-50 p-3">
        <Text className="text-sm text-yellow-700">
          🔄 Checking API connection...
        </Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View className="rounded-lg bg-red-50 p-3">
        <Text className="font-semibold text-red-800">
          ❌ API Server Disconnected
        </Text>
        <Text className="text-sm text-red-600">
          Make sure the mock server is running on {API_BASE_URL}
        </Text>
        {lastCheck && (
          <Text className="text-xs text-red-500">
            Last checked: {lastCheck.toLocaleTimeString()}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className="rounded-lg bg-green-50 p-3">
      <Text className="font-semibold text-green-800">
        ✅ API Server Connected
      </Text>
      <Text className="text-sm text-green-600">
        Connected to {API_BASE_URL}
      </Text>
      {lastCheck && (
        <Text className="text-xs text-green-500">
          Last checked: {lastCheck.toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
};