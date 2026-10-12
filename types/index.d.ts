export type Seconds = number

declare module 'claude-code' {
  interface PluginState {
    'enter-batch': { seconds: Seconds }
  }
}
