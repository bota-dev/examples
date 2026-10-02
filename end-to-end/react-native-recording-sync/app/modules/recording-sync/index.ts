import { requireNativeModule } from 'expo-modules-core';
import type {
  BotaEncryptedUploadV2ProviderContext,
  BotaEncryptedUploadV2ProfileDecision,
} from '@bota.dev/react-native-app-sdk';

export type RecordingSyncConfiguration = {
  baseUrl: string;
  appToken: string;
  deviceId: string;
  bindingGeneration: number;
  endUserId: string;
  projectId?: string;
};
export type RecordingSyncDecision = BotaEncryptedUploadV2ProfileDecision & {
  cloudRecordingId: string;
};
export type RecordingSyncNativeModule = {
  configure(configuration: RecordingSyncConfiguration): Promise<void>;
  prepare(context: BotaEncryptedUploadV2ProviderContext): Promise<RecordingSyncDecision>;
  /** Local cancellation only; call after the SDK operation settles. */
  cancel(operationId: string): Promise<void>;
  dispose(): Promise<void>;
};
const RecordingSyncNative = requireNativeModule<RecordingSyncNativeModule>('RecordingSync');
export const configure = RecordingSyncNative.configure.bind(RecordingSyncNative);
export const prepare = RecordingSyncNative.prepare.bind(RecordingSyncNative);
export const cancel = RecordingSyncNative.cancel.bind(RecordingSyncNative);
export const dispose = RecordingSyncNative.dispose.bind(RecordingSyncNative);
export default RecordingSyncNative;
