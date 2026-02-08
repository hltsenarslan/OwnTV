import * as React from 'react';

import { AndroidTvViewProps } from './AndroidTv.types';

export default function AndroidTvView(props: AndroidTvViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
