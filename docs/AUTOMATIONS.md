# ⚡ Automations — "open anything" by voice or text

JACK can launch websites and web apps on command. Just say or type an **action
word** + a **target**. Works in **English and Tamil**.

> On mobile, `https://` links open the **native app** (YouTube, WhatsApp, Maps,
> Spotify…) automatically when it is installed — otherwise the website opens.

## How to use

Say or type, for example:

| You say | JACK does |
|---------|-----------|
| `open youtube` | Opens YouTube |
| `play netflix` | Opens Netflix |
| `open video editor` | Opens Clipchamp (web video editor) |
| `open photo editor` | Opens Photopea |
| `open whatsapp` | Opens WhatsApp Web |
| `open maps` / `directions` | Opens Google Maps |
| `open translate` | Opens Google Translate |
| `open github` | Opens GitHub |
| `open chatgpt` / `open gemini` | Opens that AI |
| `யூடியூப் திற` | Opens YouTube (Tamil) |
| `வீடியோ எடிட்டர் திற` | Opens the video editor (Tamil) |

### Action words understood
**English:** open, launch, start, go to, show, play, take me to, bring up, load, visit, run
**Tamil:** திற, திறக்க, திறந்து, காட்டு, போடு, செல், ஓப்பன்

## Built-in automations (36)

- **Media:** YouTube, Netflix, Prime Video, Hotstar, Spotify
- **Editors:** Clipchamp (video), CapCut, Canva, Photopea (photo)
- **Social:** WhatsApp, Telegram, Instagram, Facebook, X/Twitter, LinkedIn, Reddit
- **Google/Productivity:** Google, Gmail, Maps, Translate, Drive, Calendar, Docs, Sheets, News, Weather
- **Shopping:** Amazon, Flipkart
- **Knowledge/AI:** ChatGPT, Claude, Gemini, Wikipedia
- **Developer:** GitHub, Stack Overflow, VS Code (web), Replit

## Teaching JACK your own automations

JACK **remembers** the commands you teach it (stored in `localStorage`).

**From chat — natural language:**
```
when I say music open https://open.spotify.com
remember my blog as https://example.com
teach: news, headlines => https://news.ycombinator.com
```

**From the ⚡ Automations tab — a form:**
- **name** (e.g. `My Blog`)
- **url** (e.g. `example.com` — `https://` is added automatically)
- **trigger words** (comma separated, e.g. `my blog, blog`)

Then say "open my blog" and JACK launches it. Tap **✕** on a taught card to
forget it.

## How matching works

1. JACK checks for an **action word** (open/play/திற…).
2. It finds the automation whose trigger phrase best matches your words —
   **longest match wins**, so "open google maps" beats "open google".
3. It opens the URL in a new tab and confirms (and speaks, if voice is on).

This gating means ordinary questions like *"how do I open a port in the
firewall?"* are **not** treated as an app-launch.
