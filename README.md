# FocusTab ⚡️

FocusTab is a modern digital wellbeing browser extension designed to help you reclaim your focus. Track your tab usage, set time limits, and run high-intensity focus sessions with a sleek **Cyberpunk Neon** aesthetic.

![Cyberpunk Neon UI](https://img.shields.io/badge/UI-Cyberpunk_Neon-bf00ff)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-00f7ff)

## ✨ Features

- **High-Intensity Focus Sessions:** Choose between *Deep Work*, *Soft Focus*, and *Pomodoro* modes to block distractions.
- **Advanced Dashboard:** Visualize your digital habits with interactive charts (powered by Chart.js) and daily usage breakdowns.
- **Real-time Time Tracking:** Monitor how much time you spend on every site throughout the day.
- **Friction Blocking:** Active redirection and attempt counting for blocked sites during sessions.
- **Cyberpunk Aesthetic:** A high-contrast, vibrant UI designed for a focused, high-tech experience.

## 🚀 Getting Started

### Prerequisites
- Google Chrome or any Chromium-based browser (Edge, Brave, etc.)

### Installation
1. Clone or download this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the root directory of this project (`/digex`).

## 🛠 Tech Stack
- **Core:** JavaScript (ES6+), HTML5, CSS3
- **Extension API:** Chrome Extension Manifest V3
- **Visualization:** [Chart.js](https://www.chartjs.org/) (Locally bundled)
- **Typography:** DM Sans & DM Mono

## 📂 Project Structure
- `/popup`: Main extension interface and session controls.
- `/dashboard`: Advanced usage analytics and historical data.
- `/background.js`: Core logic for time tracking and session management.
- `/blocked`: Redirection target for distraction blocking.
- `/libs`: Third-party dependencies (bundled locally for security).

---
*Stay focused. Reclaim your time.*
