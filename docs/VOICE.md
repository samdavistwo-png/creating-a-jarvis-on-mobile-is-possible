# 🎤 Voice — talk to JACK, and JACK talks back

JACK uses the browser's built-in **Web Speech API**, so voice works with **no
server and no API key**. It supports **English (`en-IN`)** and **Tamil
(`ta-IN`)** for both listening and speaking.

## Using voice

1. On the **Console**, pick your language: **English** or **தமிழ்**.
2. Tap the **🎤** button and speak your command (e.g. "open youtube",
   "build a firewall", "யூடியூப் திற"). The button pulses while listening.
3. JACK transcribes your speech, runs it, and replies.
4. Turn on **🔊 JACK voice** to have JACK **read its replies aloud** in the
   selected language. Replies are cleaned of markdown/emoji first so they sound
   natural.

## Browser support

| Browser | Speech-to-text (mic) | Text-to-speech (JACK speaks) |
|---------|:--:|:--:|
| Chrome (desktop/Android) | ✅ | ✅ |
| Microsoft Edge | ✅ | ✅ |
| Safari (iOS/macOS) | ✅* | ✅ |
| Firefox | ⚠️ limited | ✅ |

\* iOS Safari requires you to tap the mic each time (no continuous listening).
Tamil speech voices depend on the voices installed on your device/OS; if a Tamil
TTS voice isn't present, the OS falls back to the closest available voice.

## Notes & troubleshooting

- **Microphone permission:** the first tap prompts for mic access — allow it.
  If denied, JACK shows a message asking you to re-enable it.
- **HTTPS required:** the mic only works on `https://` origins (the deployed app
  and the tunnel URL are both HTTPS).
- **One command at a time:** recognition is one-shot for reliability — tap 🎤 for
  each command.
- If your browser lacks speech support, JACK tells you and you can still type.

## Under the hood

- `src/jack/voice.ts` wraps `SpeechRecognition` (STT) and `speechSynthesis`
  (TTS), selecting a voice that matches the active language code.
- The mic result is fed straight into the same command pipeline as typed input,
  so **every** capability (automations, security brain, LLM) is voice-driven.
