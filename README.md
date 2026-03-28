# NyaCare

AI Companion App with OpenRouter Integration for Android

## Features

- 🤖 AI-powered notifications based on active apps
- 👤 Multiple anime-style characters to choose from
- 📱 App monitoring with customizable triggers
- 🌙 Quiet hours and cooldown settings
- ✨ Beautiful glassmorphism UI

## Characters

- Kurokawa Akane
- Hoshino Ai
- Kana Arima
- Ruby Hoshino
- Aqua Hoshino
- Mem-Cho

## Tech Stack

- Capacitor 8
- Vanilla JavaScript
- OpenRouter AI API
- GitHub Actions CI/CD

## Setup

```bash
npm install
npx cap sync android
npx cap open android
```

## Building

### Local Build
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

### GitHub Actions
Automatically builds on push to main branch. Check the Actions tab for build artifacts.

## Project Structure

```
webcore/
├── src/
│   ├── backend/
│   │   ├── main.js           # App monitoring + AI integration
│   │   └── config.js         # Configuration
│   ├── character/            # Character data files
│   └── dashboard/            # Settings UI
├── www/                      # Capacitor web assets
├── android/                  # Android native project
└── .github/workflows/        # CI/CD
```

## License

MIT
