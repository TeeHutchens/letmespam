export type Cfg = {
  enterWord: string; sendWord: string; cancelWord: string
  rewrite: 'on' | 'off'; optimizer: string; effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'; preamble: string
}

declare module 'claude-code' {
  interface PluginState {
    letmespam: { cfg: Cfg; batch: { on: boolean; parts: string[] } }
  }
}
