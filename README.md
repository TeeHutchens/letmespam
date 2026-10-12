<p align="center"><img src="assets/logo.svg" width="280" alt="letmespam"></p>

# letmespam

<p align="center"><img src="assets/demo.gif" width="720" alt="letmespam demo: batch lines, then sendthespam sends them as one message"></p>

A Claude Code plugin with two input modes, so you can get every thought out before Claude starts working.

- **Normal (default):** messages send instantly.
- **Spam mode:** type `letmespam`, then enter as many lines as you like. Nothing is sent. Every line is echoed in full in the transcript.
- **Send:** type `sendthespam`. The batch goes out as one message. With rewrite turned on (`/spam-settings`), a cheap model condenses it first, so your main model reads less.
- **Discard:** type `cancelspam` to throw the batch away.

Typing while Claude is working interrupts it, and `letmespam` works at any time.

## Install

```
/plugin marketplace add teehutchens/letmespam
/plugin install letmespam
```

Or in one step:

```
/plugin install letmespam --marketplace teehutchens/letmespam
```

## Settings

Type `/spam-settings` to open the pane:

<p align="center"><img src="assets/settings.gif" width="640" alt="/spam-settings pane: toggle rewrite, pick the model, raise effort"></p>

The pane has:

- **Rewrite on send:** off by default. On, a model condenses the batch before it's sent.
- **Optimizer model:** `haiku` (default), `sonnet`, `opus`, `fable`, `session` (your chat model), or any model id. Aliases track the newest release.
- **Effort:** how hard the optimizer thinks, `low` to `max`.
- **Spam mode words:** change the start, send and discard words.
- **Rewrite instruction:** what the optimizer is told, with a reset to the built-in text.

Batches under 200 characters skip the rewrite. If the optimizer fails, your text is sent as typed.

## What it runs and sends

- It hooks your prompt box and holds spam-mode lines in memory for the session. Nothing is written to disk and no network calls are made by the plugin itself.
- Only with rewrite on, `sendthespam` sends the batch to the optimizer model you chose, through your own Claude Code session, then sends the result as your prompt.
- Its `prompt.submit` hook watches each line you submit: your start, send and discard words are swallowed into the batch, and every other prompt passes through unchanged.
- The `/spam-settings` pane saves your choices with `config.set` under the plugin's own keys only: `letmespam.enterWord`, `sendWord`, `cancelWord`, `rewrite`, `optimizer`, `effort`, `preamble`. It sets no environment variables and touches no other configuration.
- No telemetry, no files read, no commands run, no extra dependencies.

## Status

Needs a Claude Code build with the inline plugin API (`claude-code` hooks). Types are in `types/`.

MIT licensed.

## Support

letmespam is free and MIT-licensed. If it saves you time, you can [buy me a coffee on Ko-fi](https://ko-fi.com/teenottea).
