import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './AndroidTv.types';

type AndroidTvModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class AndroidTvModule extends NativeModule<AndroidTvModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(AndroidTvModule, 'AndroidTvModule');
