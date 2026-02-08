import { NativeModule, requireNativeModule } from 'expo';

import { AndroidTvModuleEvents } from './AndroidTv.types';

declare class AndroidTvModule extends NativeModule<AndroidTvModuleEvents> {
  syncChannels(channels: { id: string, name: string, logo: string }[]): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<AndroidTvModule>('AndroidTv');
