import { requireNativeView } from 'expo';
import * as React from 'react';

import { AndroidTvViewProps } from './AndroidTv.types';

const NativeView: React.ComponentType<AndroidTvViewProps> =
  requireNativeView('AndroidTv');

export default function AndroidTvView(props: AndroidTvViewProps) {
  return <NativeView {...props} />;
}
