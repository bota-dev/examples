/**
 * Bota Context - SDK state management
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  BotaClient,
  type DiscoveredDevice,
  type ConnectedDevice,
  type DeviceStatus,
  type BluetoothState,
} from '@bota/react-native-sdk';

interface BotaContextType {
  // Bluetooth state
  bluetoothState: BluetoothState;
  isBluetoothReady: boolean;

  // Scanning
  isScanning: boolean;
  discoveredDevices: DiscoveredDevice[];
  startScan: () => Promise<void>;
  stopScan: () => void;

  // Connection
  connectedDevice: ConnectedDevice | null;
  isConnecting: boolean;
  connect: (device: DiscoveredDevice) => Promise<ConnectedDevice>;
  disconnect: () => Promise<void>;

  // Status
  deviceStatus: DeviceStatus | null;

  // Error
  error: string | null;
  clearError: () => void;
}

const BotaContext = createContext<BotaContextType | undefined>(undefined);

export function BotaProvider({children}: {children: React.ReactNode}) {
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>(
    BotaClient.bluetoothState,
  );
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>(
    [],
  );
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDevice | null>(
    null,
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set up SDK event listeners
  useEffect(() => {
    // Bluetooth state
    const handleBluetoothState = (state: BluetoothState) => {
      setBluetoothState(state);
    };

    // Device discovery
    const handleDeviceDiscovered = (device: DiscoveredDevice) => {
      setDiscoveredDevices(prev => {
        const existing = prev.find(d => d.id === device.id);
        if (existing) {
          return prev.map(d => (d.id === device.id ? device : d));
        }
        return [...prev, device];
      });
    };

    // Device connection events
    const handleDeviceConnected = (device: ConnectedDevice) => {
      setConnectedDevice(device);
      setIsConnecting(false);
    };

    const handleDeviceDisconnected = (deviceId: string, err?: Error) => {
      if (connectedDevice?.id === deviceId) {
        setConnectedDevice(null);
        setDeviceStatus(null);
        if (err) {
          setError(`Device disconnected: ${err.message}`);
        }
      }
    };

    // Status updates
    const handleStatusUpdated = (deviceId: string, status: DeviceStatus) => {
      if (connectedDevice?.id === deviceId) {
        setDeviceStatus(status);
      }
    };

    // Scan events
    const handleScanStarted = () => setIsScanning(true);
    const handleScanStopped = () => setIsScanning(false);
    const handleScanError = (err: Error) => {
      setIsScanning(false);
      setError(`Scan error: ${err.message}`);
    };

    // Subscribe to events
    BotaClient.on('bluetoothStateChanged', handleBluetoothState);
    BotaClient.devices.on('deviceDiscovered', handleDeviceDiscovered);
    BotaClient.devices.on('deviceConnected', handleDeviceConnected);
    BotaClient.devices.on('deviceDisconnected', handleDeviceDisconnected);
    BotaClient.devices.on('deviceStatusUpdated', handleStatusUpdated);
    BotaClient.devices.on('scanStarted', handleScanStarted);
    BotaClient.devices.on('scanStopped', handleScanStopped);
    BotaClient.devices.on('scanError', handleScanError);

    return () => {
      BotaClient.off('bluetoothStateChanged', handleBluetoothState);
      BotaClient.devices.off('deviceDiscovered', handleDeviceDiscovered);
      BotaClient.devices.off('deviceConnected', handleDeviceConnected);
      BotaClient.devices.off('deviceDisconnected', handleDeviceDisconnected);
      BotaClient.devices.off('deviceStatusUpdated', handleStatusUpdated);
      BotaClient.devices.off('scanStarted', handleScanStarted);
      BotaClient.devices.off('scanStopped', handleScanStopped);
      BotaClient.devices.off('scanError', handleScanError);
    };
  }, [connectedDevice?.id]);

  const startScan = useCallback(async () => {
    setDiscoveredDevices([]);
    setError(null);
    await BotaClient.devices.startScan({timeout: 30000});
  }, []);

  const stopScan = useCallback(() => {
    BotaClient.devices.stopScan();
  }, []);

  const connect = useCallback(async (device: DiscoveredDevice) => {
    setIsConnecting(true);
    setError(null);

    try {
      const connected = await BotaClient.devices.connect(device);
      return connected;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      setIsConnecting(false);
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectedDevice) {
      await BotaClient.devices.disconnect(connectedDevice);
      setConnectedDevice(null);
      setDeviceStatus(null);
    }
  }, [connectedDevice]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <BotaContext.Provider
      value={{
        bluetoothState,
        isBluetoothReady: bluetoothState === 'poweredOn',
        isScanning,
        discoveredDevices,
        startScan,
        stopScan,
        connectedDevice,
        isConnecting,
        connect,
        disconnect,
        deviceStatus,
        error,
        clearError,
      }}>
      {children}
    </BotaContext.Provider>
  );
}

export function useBota() {
  const context = useContext(BotaContext);
  if (!context) {
    throw new Error('useBota must be used within a BotaProvider');
  }
  return context;
}
