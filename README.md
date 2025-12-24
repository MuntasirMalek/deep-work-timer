# Deep Work Timer ⏱️

A clean, distraction-free deep work timer inspired by Cal Newport's [Deep Work](https://www.calnewport.com/books/deep-work/) philosophy. Uses research-backed timing methods to maximize focus and productivity.


## 🚀 Live Demo

**[Try it now on GitHub Pages →](https://MuntasirMalek.github.io/deep-work-timer/)**

## ✨ Features

- **Two Timing Rules:**
  - **90/20 Rule** - 90 min deep work + 20 min break (Ultradian Rhythms)
  - **50/10 Rule** - 50 min deep work + 10 min break (Standard hour)

- **Smart Delay System:**
  - 1-minute buffer after work sessions (Google Pixel ringtone)
  - 5-minute wake-up alarm after breaks (Nokia Tune loop)
  - Skip button to move to next phase immediately

- **Progress Tracking:**
  - Real-time "Deep Work Time So Far" counter
  - Daily total tracking (resets at midnight)
  - Cycle counter for multi-session days

- **Mobile-First Design:**
  - Works offline (PWA support)
  - Wake lock keeps screen on
  - Push notifications
  - Installable on Android/iOS

## 🛠️ Tech Stack

- Vanilla HTML, CSS, JavaScript
- Progressive Web App (PWA)
- Service Worker for offline support
- Web Notifications API
- Wake Lock API

## 📦 Installation

### Use Online
Simply visit the [GitHub Pages link](https://MuntasirMalek.github.io/deep-work-timer/) and start working!

### Self-Host
1. Clone the repository:
   ```bash
   git clone https://github.com/MuntasirMalek/deep-work-timer.git
   ```
2. Serve with any static server:
   ```bash
   cd deep-work-timer
   python3 -m http.server 3000
   ```
3. Open http://localhost:3000

### Install as App
1. Visit the site on your phone
2. Click "Add to Home Screen" (iOS) or install prompt (Android)
3. Use like a native app!

## 📁 Project Structure

```
deep-work-timer/
├── index.html      # Main app
├── app.js          # Timer logic, delays, calculations
├── style.css       # Styling and animations
├── sw.js           # Service worker for offline
├── manifest.json   # PWA manifest
├── logo.png        # App icon
├── delay_tone.mp3  # Post-work delay sound
├── alarm_tone.mp3  # Post-break alarm sound
└── notification.mp3 # Notification fallback
```

## 🎯 How It Works

1. **Start a Session** - Choose 90/20 or 50/10 rule
2. **Deep Work Phase** - Focus timer counts down
3. **Post-Work Delay** - 1-minute buffer (can skip)
4. **Break Phase** - Rest and recharge
5. **Wake-Up Alarm** - 5-minute looping alarm before next cycle
6. **Repeat** - Continue for as many cycles as needed

## 🧪 Quick Testing

Want to test with shorter times? Open browser console (F12) and run:

```javascript
startStudy(1, 0.5)    // 1 min work, 30 sec break
startStudy(0.5, 0.25) // 30 sec work, 15 sec break
startStudy(2, 1)      // 2 min work, 1 min break
```

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - feel free to use in your own projects!

## 🙏 Acknowledgments

- Inspired by Cal Newport's "Deep Work"
- Ultradian Rhythm research
- Nokia & Google for iconic ringtones

---

Made with ❤️ for focused work
