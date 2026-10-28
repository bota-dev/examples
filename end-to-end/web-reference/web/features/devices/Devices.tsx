import { useState, useSyncExternalStore } from 'react';
import type { Mode } from '../../api';
import type { DeviceSession } from './device-session';

export function Devices({
  devices,
  owner,
  mode,
}: {
  devices: DeviceSession;
  owner: object;
  mode: Mode;
}) {
  const state = useSyncExternalStore(devices.subscribe, devices.getSnapshot);
  const [serial, setSerial] = useState('');
  const busy = ['preparing', 'connecting', 'reading', 'closing'].includes(state.phase);
  const disabled = mode === 'demo' || ['blocked', 'unavailable'].includes(state.phase);
  return (
    <details className="devices-panel">
      <summary>
        Devices <span className="muted">Optional Bluetooth connection</span>
      </summary>
      <div className="devices-content">
        <p className="muted">
          Connect a wearable to read its status. Recordings remain available without a device.
        </p>
        <p role="status">{state.message}</p>
        <div className="device-actions">
          <button
            className="secondary-button"
            disabled={disabled || busy || state.phase !== 'idle'}
            onClick={() => void devices.prepare(owner)}
          >
            Prepare Bluetooth
          </button>
          <label htmlFor="device-serial">Device serial</label>
          <input
            id="device-serial"
            autoComplete="off"
            value={serial}
            maxLength={64}
            disabled={disabled || busy || !!state.connection}
            onChange={(event) => setSerial(event.target.value)}
          />
          <button
            className="primary-button"
            disabled={disabled || state.phase !== 'ready' || !serial.trim()}
            onClick={() => void devices.connect(owner, serial)}
          >
            Connect device
          </button>
          <button
            className="secondary-button"
            disabled={disabled || state.phase !== 'connected'}
            onClick={() => void devices.readStatus(owner)}
          >
            Read status
          </button>
          <button
            className="secondary-button"
            disabled={disabled || busy || !state.connection}
            onClick={() => void devices.disconnect(owner)}
          >
            Disconnect device
          </button>
        </div>
        {state.connection ? (
          <p>
            Connected serial: <strong>{state.connection.serialNumber}</strong>
          </p>
        ) : null}
        {state.status ? (
          <dl className="device-status">
            <div>
              <dt>Battery</dt>
              <dd>{state.status.battery}%</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{state.status.state}</dd>
            </div>
            <div>
              <dt>Firmware</dt>
              <dd>{state.status.firmware || 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Read at</dt>
              <dd>{state.status.readAt}</dd>
            </div>
          </dl>
        ) : null}
        <p className="small-note">
          Desktop Chromium on HTTPS or localhost. Connection does not confirm pairing, cloud
          ownership or upload permission. No capture or device recording transfer.
        </p>
      </div>
    </details>
  );
}
