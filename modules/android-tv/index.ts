// Reexport the native module. On web, it will be resolved to AndroidTvModule.web.ts
// and on native platforms to AndroidTvModule.ts
export { default } from './src/AndroidTvModule';
export { default as AndroidTvView } from './src/AndroidTvView';
export * from  './src/AndroidTv.types';
