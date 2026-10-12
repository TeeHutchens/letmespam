export type Cfg = {
  enterWord: string; sendWord: string; cancelWord: string
  optimizer: string; effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'; preamble: string
}

declare module 'claude-code' {
  interface PluginState {
    letmespam: { cfg: Cfg; mode: { on: boolean; count: number } }
  }
}
