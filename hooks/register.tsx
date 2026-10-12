import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'letmespam'
const BLUE = '#2b6fff' // spam-tin blue
// Aliases (haiku, sonnet, ...) always resolve to the newest model of that family, so new releases need no code change.
const MODELS = [
  { value: 'haiku', label: 'Haiku — fastest, cheapest' },
  { value: 'sonnet', label: 'Sonnet — balanced' },
  { value: 'opus', label: 'Opus — most thorough' },
  { value: 'fable', label: 'Fable' },
  { value: 'session', label: 'Same as this session' },
]
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'].map(value => ({ value }))
const WORDS = { enterWord: 'letmespam', sendWord: 'sendthespam', cancelWord: 'cancelspam' }
const squash = (t: string) => t.toLowerCase().replace(/[\s.!?]+/g, '') // 'Let me spam!' matches 'letmespam'
const DEFAULT_PREAMBLE =
  "Rewrite the user's raw thoughts as one concise, organized, prioritized request. Keep every detail, drop filler. Output only the rewrite."
const MIN_CHARS = 200 // below this a rewrite costs more than it saves
const LOG_CHUNK = 1900 // ui.log draws only the first 2000 chars of a row
type Cfg = {
  enterWord: string; sendWord: string; cancelWord: string
  rewrite: 'on' | 'off'; optimizer: string; effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'; preamble: string
}
type Effort = Cfg['effort']
// batch lives in the host (an atom), not in module variables: a plugin reload must not forget an open batch
const batchAtom = atom({ plugin: 'letmespam', key: 'batch' } as const, { on: false, parts: [] as string[] })
const cfgAtom = atom({ plugin: 'letmespam', key: 'cfg' } as const, {
  ...WORDS, rewrite: 'off', optimizer: 'haiku', effort: 'low', preamble: DEFAULT_PREAMBLE,
} as Cfg)

export const register: Register = (on, options) => {
  const word = (k: keyof typeof WORDS) => squash(String(options[k] || WORDS[k]))
  const initial: Cfg = {
    enterWord: word('enterWord'), sendWord: word('sendWord'), cancelWord: word('cancelWord'),
    rewrite: options.rewrite === 'on' ? 'on' : 'off',
    optimizer: String(options.optimizer || 'haiku').trim(),
    effort: (EFFORTS.some(f => f.value === options.effort) ? options.effort : 'low') as Effort,
    preamble: String(options.preamble || DEFAULT_PREAMBLE),
  }
  let cfg = initial // live copy used by prompt.submit; the atom feeds the pane
  let running: string | undefined // id of the model turn in flight, so typing can interrupt it

  on('session.start', async ($, e, next) => {
    const saved = await $.store.get('cfg')
    if (saved && typeof saved === 'object') cfg = { ...initial, ...(saved as Partial<Cfg>) }
    await update($, cfgAtom, () => cfg)
    await $.command.register({ name: 'spam-settings', description: 'Open the letmespam settings pane' })

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    running = e.turnId
    return next(e)
  })
  on('turn.complete', ($, e, next) => {
    if (running === e.turnId) running = undefined
    return next(e)
  })

  on('command.run', { command: 'spam-settings' }, async $ => {
    await $.ui.open({ id: PANE, title: 'letmespam', focus: true })

    return { text: 'letmespam settings opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Input, Button } = $.ui.resolve(e) as Extract<ReturnType<typeof $.ui.resolve>, { Input: unknown }>
    const v = await read($, cfgAtom)
    // live now; the store keeps it for next session
    const set = async <K extends keyof Cfg>(k: K, val: Cfg[K]) => {
      cfg = { ...cfg, [k]: val }
      await update($, cfgAtom, () => cfg)
      await $.store.set('cfg', cfg)
    }
    const setWord = (k: keyof typeof WORDS) => (t: string) => set(k, squash(t) || WORDS[k])
    const known = MODELS.some(m => m.value === v.optimizer)
    const ei = EFFORTS.findIndex(f => f.value === v.effort)
    const step = (d: number) => set('effort', EFFORTS[Math.min(EFFORTS.length - 1, Math.max(0, ei + d))]!.value as Effort)
    // same look as Claude Code's /model: numbered list, ✔ on the current one, effort as dots
    // plain helper, not a component: the ui table only takes its own elements
    const section = (title: string, hint: string, kids: unknown[]) => (
      <Box key={title} flexDirection="column" marginBottom={1}>
        <Text bold color={BLUE}>{title}</Text>
        <Text dimColor>{hint}</Text>
        {kids as never}
      </Box>
    )

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="#c8cbd2">  ╭──────────╮</Text>
        <Text color={BLUE}>  │<Text color="#ffe27a" bold>letmespam!</Text>│  <Text bold color={BLUE}>letmespam</Text></Text>
        <Text color={BLUE}>  ╰──────────╯  <Text dimColor>batch your thoughts, send once</Text></Text>
        <Text> </Text>
        {section('Rewrite on send', 'ON: a model condenses the batch before it is sent (one extra small call). OFF: your lines are sent exactly as typed.', [
          <Button key="rewrite" hotkey="r" label={v.rewrite === 'on' ? '● ON   (press r to turn off)' : '○ OFF  (press r to turn on)'}
            onPress={() => set('rewrite', v.rewrite === 'on' ? 'off' : 'on')} />,
        ])}
        {section('Optimizer model', 'Used only when rewrite is ON. Your chat model is still set with /model.', [
          ...MODELS.map((m, i) => (
            <Button key={m.value} hotkey={String(i + 1)} plain
              label={`${m.value === v.optimizer ? '❯' : ' '} ${i + 1}. ${m.label}${m.value === v.optimizer ? ' ✔' : ''}`}
              onPress={() => set('optimizer', m.value)} />
          )),
          <Input key="custom" label={known ? '  Custom model id ' : '❯ Custom model id ✔ '} value={known ? '' : v.optimizer}
            placeholder="any alias or full model id" onSubmit={t => t.trim() && set('optimizer', t.trim())} />,
        ])}
        {section('Effort', 'How hard the optimizer thinks. Higher is slower and costs more.', [
          <Box key="dots">
            <Text color={BLUE}>{EFFORTS.map((f, i) => (i <= ei ? '●' : '○')).join(' ')}  </Text>
            <Text bold>{v.effort}</Text>
          </Box>,
          <Box key="btns">
            <Button key="lower" label="◀ lower" hotkey="h" onPress={() => step(-1)} />
            <Text> </Text>
            <Button key="higher" label="higher ▶" hotkey="l" onPress={() => step(1)} />
          </Box>,
        ])}
        {section('Spam mode words', 'Each is typed alone on a line.', [
          <Input key="enter" label="Start   " value={v.enterWord} placeholder={WORDS.enterWord} onSubmit={setWord('enterWord')} />,
          <Input key="send" label="Send    " value={v.sendWord} placeholder={WORDS.sendWord} onSubmit={setWord('sendWord')} />,
          <Input key="cancel" label="Discard " value={v.cancelWord} placeholder={WORDS.cancelWord} onSubmit={setWord('cancelWord')} />,
        ])}
        {section('Rewrite instruction', 'What the optimizer model is told. Used only when rewrite is ON.', [
          <Text key="cur">{v.preamble.length > 240 ? v.preamble.slice(0, 240) + '…' : v.preamble}</Text>,
          <Text key="state" dimColor>{v.preamble === DEFAULT_PREAMBLE ? '(built-in default)' : '(your custom instruction)'}</Text>,
          <Input key="preamble" label="New instruction " value="" placeholder="type, then Enter to save"
            onSubmit={t => t.trim() && set('preamble', t.trim())} />,
          <Button key="reset" hotkey="d" label="↺ Reset to default (d)" onPress={() => set('preamble', DEFAULT_PREAMBLE)} />,
        ])}
        <Text dimColor>r rewrite · 1-{MODELS.length} model · h/l effort · Enter saves a field · Esc closes · batches under {MIN_CHARS} chars skip the rewrite</Text>
        <Text dimColor>Enjoying letmespam? ko-fi.com/teenottea</Text>
      </Box>
    )
  })

  // blue band above the prompt while a batch is open: you always know you're in letmespam
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const m = await read($, batchAtom)
    if (!m.on || e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text bold inverse color={BLUE}> letmespam </Text>
        <Text color={BLUE}> {m.parts.length} spam · "{cfg.sendWord}" sends · "{cfg.cancelWord}" discards</Text>
      </Box>
    )
  })

  on('prompt.submit', async ($, e, next) => {
    // only the person's own typing; slash commands pass through
    const isMine = e.origin.kind === 'composer' && !e.text.startsWith('/')
    if (!isMine) return next(e)

    const say = (text: string) => {
      for (let i = 0; i < text.length || i === 0; i += LOG_CHUNK) $.ui.log(text.slice(i, i + LOG_CHUNK))
    }
    let { on: spam, parts } = await read($, batchAtom)
    const save = () => update($, batchAtom, () => ({ on: spam, parts }))
    // a dropped line can leave its text in the input bar; empty it after the composer has finished with it
    const swallow = (reason: string) => {
      // twice: right away, and after the composer has finished handing the line back
      const clear = () => $.prompt.fill({ text: '', mode: 'replace' }).catch(() => {})
      void clear()
      void $.clock.sleep(150).then(clear).catch(() => {})
      return { drop: reason }
    }
    const word = squash(e.text)
    const isWord = word === cfg.enterWord || word === cfg.sendWord || word === cfg.cancelWord

    // typing while Claude is working interrupts it, then the line is handled as usual
    // (a plain batched line in spam mode doesn't: it's only collected)
    if (running && (!spam || isWord)) {
      $.turn.abort({ turnId: running }).catch(() => {}) // turn may have just ended
      running = undefined
    }

    if (!spam) {
      if (word !== cfg.enterWord) return next(e) // normal mode: send instantly
      spam = true
      await save()
      $.ui.status(`letmespam — "${cfg.sendWord}" sends, "${cfg.cancelWord}" discards`)
      say(`▌ letmespam ▐ ON. Enter as much as you like; nothing is sent until you type "${cfg.sendWord}" ("${cfg.cancelWord}" discards).`)
      return swallow('spam mode on')
    }

    if (word === cfg.cancelWord) {
      say(`▌ letmespam ▐ OFF — discarded ${parts.length} spam(s).`)
      spam = false; parts = []
      await save()
      $.ui.status(undefined)
      return swallow('spam discarded')
    }

    if (word === cfg.sendWord) {
      const raw = parts.join('\n\n')
      spam = false; parts = []
      await save()
      if (!raw) {
        $.ui.status(undefined)
        say('▌ letmespam ▐ OFF — nothing was batched.')
        return swallow('empty batch')
      }
      let text = raw
      try {
        if (cfg.rewrite === 'on' && cfg.optimizer !== 'off' && raw.length >= MIN_CHARS) {
          $.ui.status(`letmespam — optimizing with ${cfg.optimizer} (${cfg.effort})…`)
          say(`⚙ Optimizing ${raw.length} chars with ${cfg.optimizer}, effort ${cfg.effort}…`)
          const model = cfg.optimizer === 'session' ? await $.session.model() : cfg.optimizer
          const r = await $.model.complete({
            model, system: cfg.preamble, prompt: raw, effort: cfg.effort,
            maxTokens: Math.min(4000, Math.ceil(raw.length / 3) + 200), // rewrite should never be longer than the input
            timeoutMs: 30000,
          })
          if (r.isAnswered && r.text.trim()) text = r.text.trim()
          else say('⚠ Optimizer failed — sending your text as typed.')
        }
      } catch {
        say('⚠ Optimizer errored — sending your text as typed.') // never lose the batch
      }
      $.ui.status(undefined)
      return next({ ...e, text }) // the send word becomes the batch itself, sent as the person's own prompt
    }

    parts = [...parts, e.text]
    await save()
    $.ui.status(`letmespam — ${parts.length} spam, "${cfg.sendWord}" sends`)
    say(`┃ spam ${parts.length}: ${e.text}`)

    return swallow(`spam ${parts.length}`)
  })
}
