<div align="center">

```
 ____  _____ _   _ ____  ____  _____
/ ___||_   _| | | |  _ \|  _ \|_   _|
\___ \  | | | | | | |_) | | | | | |
 ___) | | | | |_| |  __/| |_| | | |
|____/  |_|  \___/|_|   |____/  |_|
```

### **Stupid. Fast. Wrong.**

_The customer-support chatbot that transfers you to 7 departments and solves 0 problems._

![React](https://img.shields.io/badge/React-19-0EC7F5?style=for-the-badge&logo=react&logoColor=08080A&labelColor=08080A)
![Vite+](https://img.shields.io/badge/Vite%2B-1.7-FFE600?style=for-the-badge&logo=vite&logoColor=FFE600&labelColor=08080A)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-1FE03F?style=for-the-badge&logo=tailwindcss&logoColor=1FE03F&labelColor=08080A)
![Gemini](https://img.shields.io/badge/Gemini-optional-FF6B1A?style=for-the-badge&logo=googlegemini&logoColor=FF6B1A&labelColor=08080A)
![Helpfulness](https://img.shields.io/badge/Helpfulness-0%25-F52820?style=for-the-badge&labelColor=08080A)

**MALFUNCTION 2026 · Hackathon Entry**

</div>

---

## What is this?

**StuPDT** is a satirical AI support desk. Ask it anything. It will never answer.

Instead it gives you a cheerful corporate non-answer, hands you off to a new "specialist", makes you confirm obvious facts, asks for forms that depend on other forms, and blames Mercury retrograde. It's a parody of every support chatbot that ever said _"I understand your frustration"_ and then did nothing.

It is also a real, fully working React app with live AI, vision analysis, a themed accessibility suite, a sound engine and a mock bureaucracy engine. All of it is built to be as unhelpful as possible.

> **Works with zero setup.** No API key and no backend needed. Without them, StuPDT uses built-in deterministic replies and is exactly as useless as before.

---

## Try it in 60 seconds

```bash
pnpm install
pnpm dev
```

Open **http://localhost:5173**, then run through the demo below.

### The guided demo: "Exam Tomorrow"

Type each message (or click the suggested reply chip above the input):

| #   | You say                                           | StuPDT does                                                                                              |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `I have an exam tomorrow. Can you help me study?` | Transfers you to Academic Assistance, which asks you to **confirm you are a student**                    |
| 2   | `Yes, I am a student.` (or just `Okay.`)          | _"Congratulations! You're a student. We only assist non-students."_                                      |
| 3   | `WHAT?`                                           | Apologizes sincerely. Your ticket number is unavailable because the **Ticket Number Department is down** |
| 4   | `StuPDT, PLEASE JUST ANSWER MY QUESTION.`         | 🚨 **The Grand Finale**                                                                                  |

The suggested-reply chip above the input always offers the next step, so you can click through the whole demo.

### Other things worth typing

| Try                          | Result                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `Fix my Wi-Fi`               | Confidence Without Competence™: _"Your Wi-Fi needs internet."_                               |
| `What time is it?`           | Asks you to confirm in writing that you exist within **linear time**                         |
| `I want a refund`            | Executive Management apologizes, then forwards it to a department that forwards it back      |
| `Can I speak to a manager?`  | Escalates to THE CEO AI, who has never answered a question and sends you back to the start   |
| Anything else                | Moves to the next department down the chain, which quotes your own question back at you      |

---

## Features

### 🏢 Seven departments, zero solutions

Every reply comes from a persona with its own accent colour and system prompt. Each message shows a **Confidence**, **Accuracy** (always `CLASSIFIED`) and **Blame** badge.

| Code              | Department                          | Specialty                             |
| ----------------- | ----------------------------------- | ------------------------------------- |
| `AGENT #001`      | Frontline Referral Specialist       | Transfers 100% of incoming questions  |
| `AGENT #002`      | Obvious Fact Verification Officer   | Asks you to confirm obvious things    |
| `SUPERVISOR #003` | Catch-22 Policy Director            | Only assists the exact opposite group |
| `EXEC-009`        | Chief Incompetence Officer          | Ensures 0% of problems are solved     |
| `BUREAU-004`      | Chief Paperwork Architect           | Form 001-B needs Form 001-C first     |
| `BLAME-005`       | Confidence Without Competence™ Lead | 99.97% confident, 0% helpful          |
| `CEO-000`         | Chief Executive Hallucinator        | Has never answered a question         |

Open the **ⓘ** icon in the header to see the org chart and manually transfer yourself (your conversation history will be dropped, naturally).

### 📋 Form 001 Bureaucracy Simulator

Fill out Forms 001, 001-A, 001-B and 001-C. Submit them. Get a Catch-22 error. Use the **Emergency Rubber Stamp Bypass** to have them all approved and shredded instantly.

### 📷 StuPDT Vision™

Upload a photo, or run one of the built-in samples (rock, spaghetti, water). Vision identifies the main object and reports, with **100.00% confidence**, that your rock is a rock. Ingredients list: _Rock (100%)_.

### ☀️ The Theme Gatekeeper

The app starts in a dark crosshair-poster theme. Switching to **Light Mode** requires you to:

1. Pass a CAPTCHA (select only the 3 real Traffic Lights, not "Just a Rock" or "Our CEO AI")
2. Solve a **Mandatory Legal Math** problem (a hint is available from a Math Specialist who is "risking termination")

### 🎡 Wheel of Languages

You don't pick a language. Click the language button in the header and a wheel spins; whatever wedge lands under the pointer is applied to the **entire UI**. The winner is chosen before the animation starts, so what you see is always what you get. Twelve wedges mix real languages with joke dialects:

English, Español, Pirate, Français, Deutsch, Skibidi, 日本語, Português, tlhIngan (Klingon), Filipino, हिन्दी and Igpay Atinlay (Pig Latin).

Pirate, Skibidi and Klingon use partial dictionaries. Pig Latin is algorithmic, so it works on any runtime string. Respects `prefers-reduced-motion` (the spin shortens to a blink).

### ♿ Accessibility, interpreted loosely

- **Braille mode** converts all visible UI text to Unicode Braille
- **Sign Language widget** is a floating picture-in-picture interpreter that gestures along with the latest reply
- **Sound engine** gives you chimes, rubber stamps, error buzzes, a transfer-hold tune and a klaxon, all synthesized in-browser. Mute any time.

### 🧰 Useless Toolkit™

A 47-page apology PDF, Emotional Support Mode (StuPDT needs _you_ to comfort _it_), a 99% Loading Simulator, a Human Department that is being replaced by AI, and **Premium Nothing™** for ₱999 imaginary pesos.

### 🏢 THE OFFICE (live staff feed)

Under the chat there is a live, sprite-animated break room with four staffers, **Gab, Neal, Drake and Janus**. When nobody is chatting they mind their own business: table tennis (1v1 and 2v2), chess, pull-ups, the punching bag, weights, the computer, a bean-bag nap, and the occasional all-hands couch summit.

**Send a message and they drop everything.** Everyone startles, runs to a huddle and **argues about your message** in speech bubbles: the Blame Game, Ticket Hot Potato, Rock-Paper-Scissors for who has to answer, a Vote, or Neal opening The Laptop. The argument is picked by your prompt's text, so the same prompt gets the same arc. Once the real reply lands they deliver a verdict that blames the responding department, then wander back to doing nothing. Send another prompt mid-argument and you get _"Another one?!"_ and a bigger ticket pile. Trigger the Grand Finale and it's **Code Red**.

- The staff quote the incoming ticket while they gather. Fast replies bring a department verdict within about 2.5 seconds. During a long transfer the committee keeps talking. The Office runs locally and makes no extra API calls.
- Accessibility: the bubbles are mirrored in a caption strip (`aria-live`). It respects Braille mode, mute, dark/light themes and `prefers-reduced-motion`. If the office is off-screen when you send, a chip offers to scroll to it (it never auto-scrolls).
- Add `?office-debug` to see station anchors, furniture boundaries, planned paths and sprite pivots. The controls and in-place animation player sit below the feed. Press `1–9` to force a scene, `H` for a prompt, `R` for a reply or `C` for Code Red.
- Design notes, calibration and the acceptance checks are in [`docs/OFFICE_NOTES.md`](docs/OFFICE_NOTES.md). The frames that would replace the faked poses are in [`docs/OFFICE_ART_WISHLIST.md`](docs/OFFICE_ART_WISHLIST.md).

### 📊 Live chaos telemetry

Departments consulted, internal meetings, minutes wasted, user satisfaction (floors at **-999**) and a Chaos Meter. Reach 100% and a national bureaucratic emergency is declared. Open **Report** to see your damage.

---

## Configuration

Everything below is **optional**. Copy `.env.example` to `.env` to use it.

| Variable              | Where it's used              | Purpose                                                                                   |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`      | Server (`/api/gemini` proxy) | Live AI chat and image detection. Keeps the key private. **Recommended for deployments.** |
| `GEMINI_MODEL`        | Server                       | Model override for the proxy                                                              |
| `VITE_API_BASE_URL`   | Browser                      | Backend base URL. Leave blank for relative `/api`                                         |
| `VITE_GEMINI_API_KEY` | Browser                      | Calls Gemini directly from the client. **Local dev only**                                 |
| `VITE_GEMINI_MODEL`   | Browser                      | Model override for direct client calls (default `gemini-3-flash-preview`)                 |
| `VITE_BACKEND_URL`    | Vite dev server              | Target for the `/api` dev proxy (default `http://127.0.0.1:8000`)                         |

> ⚠️ **Anything prefixed `VITE_` is bundled into the client and visible to every visitor.** Never ship a real `VITE_GEMINI_API_KEY` to production. Use `GEMINI_API_KEY` on the server instead.

### How a reply is resolved

StuPDT degrades gracefully, so the demo can't be broken by a missing backend:

```
 Your message
      │
      ▼
 ┌────────────────────────────────┐
 │ Conversation engine (local)    │  ALWAYS runs. Detects the intent, picks the
 │ services/conversationEngine.js │  next department, the blame, the next chip,
 └───────────────┬────────────────┘  and writes a complete offline reply.
                 │
                 ▼
 ┌─────────────────────┐   ok: the backend's reply wins (field by field)
 │ POST /api/chat      │──────────────────────────────────────────────┐
 └──────────┬──────────┘                                              │
            │ fail                                                    │
            ▼                                                         ▼
 ┌─────────────────────┐   ok: Gemini's text, in the voice of    ┌───────────┐
 │ POST /api/gemini    │───────────────────────────────────────▶ │   Reply   │
 └──────────┬──────────┘   the department the engine chose       └───────────┘
            │ fail                                                    ▲
            ▼                                                         │
   the engine's own reply ────────────────────────────────────────────┘
```

Routing is decided by the engine in every case, so the demo flow and the department rotation work with no backend and no API key. The one scripted exception is the Grand Finale, which `useChat` triggers before any of this runs.

> **Backend note:** the `/api/chat`, `/api/bureaucracy/submit`, `/api/metrics`, `/api/health` and `/api/gemini` endpoints are **not included in this repo**. The frontend treats them as optional, and the status pills show whether a backend is reachable. If you run a FastAPI backend on port `8000` (e.g. `pnpm backend`, which expects a sibling `../STUPDT_BACKEND` folder with its own `.venv`), the Vite dev server proxies `/api` to it automatically.

---

## Scripts

The project uses **pnpm** and **Vite+** (`vp`).

| Command        | What it does                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------- |
| `pnpm dev`     | Start the dev server on port `5173`                                                           |
| `pnpm backend` | Start the optional FastAPI backend from `../STUPDT_BACKEND` on port `8000` (alias: `pnpm dev:backend`) |
| `pnpm build`   | Type-check with `tsc -b`, then production build                                               |
| `pnpm preview` | Serve the production build locally                                                            |
| `pnpm lint`    | Lint with type-aware rules (`react/rules-of-hooks` is an error)                               |
| `pnpm test`    | Run the unit tests (reply engine: intents, routing, replies, no-backend regression)           |
| `pnpm sprites` | Rebuild THE OFFICE sprite atlases from `art/source` (dev-only `sharp`; outputs are committed) |

### Deploying to Vercel (GitHub Actions)

[`.github/workflows/ci-deploy.yml`](.github/workflows/ci-deploy.yml) lints and builds on every push and PR, then deploys with the Vercel CLI:

- **Pull request:** a preview deploy, with the URL posted as a PR comment (skipped for fork PRs, which have no secrets).
- **Push to `main`:** a production deploy.

One-time setup:

1. Create the project in Vercel and run `vercel link` locally. It writes `.vercel/project.json` with your `orgId` and `projectId`.
2. Add three repository secrets in GitHub (Settings → Secrets and variables → Actions): `VERCEL_TOKEN` (from vercel.com/account/tokens), `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.
3. In the Vercel project, disconnect the Git repository so Vercel's own integration doesn't deploy a second time.
4. Set `GEMINI_API_KEY` (optional) in Vercel's Environment Variables. The workflow pulls it at build time.

Build settings live in [`vercel.json`](vercel.json). Note that the Vercel project has no `/api` functions of its own in this repo, so live AI only works if you add them or point `VITE_API_BASE_URL` at a backend.

### Docker

A multi-stage `Dockerfile` builds the app with pnpm and serves `dist/` from nginx on port 80. [`nginx.conf`](nginx.conf) falls back to `index.html` for SPA routes and proxies `/api/` to `http://backend:8000`, so run it on a network with a service named `backend` (or edit the config).

```bash
docker build -t stupdt-frontend .
docker run -p 8080:80 stupdt-frontend
```

Without a `backend` host the proxy returns errors for `/api`, and the app falls back to its offline replies.

---

## Project structure

```
STUPDT_FRONTEND/
├── index.html
├── Dockerfile                # Build with pnpm, serve with nginx
├── nginx.conf                # SPA fallback + /api reverse proxy
├── vite.config.ts            # Vite+ config, /api dev proxy, lint rules
├── tailwind.config.js
├── .env.example
├── public/
│   └── favicon.svg
├── art/
│   ├── source/               # Original sprite sheets + office image (not bundled)
│   └── qa/contact-sheet.png  # Every extracted frame, pivots + baselines
├── scripts/
│   └── build-sprites.mjs     # `pnpm sprites`: sheets -> atlases, WebP, prop patches
├── docs/                     # OFFICE_NOTES.md, OFFICE_ART_WISHLIST.md
└── src/
    ├── main.jsx
    ├── App.jsx               # Layout, Theme Gatekeeper logic, ErrorBoundary
    │
    ├── assets/office/        # office.webp, prop patches, sprites/<name>.png + .json
    │
    ├── components/
    │   ├── chat/             # ChatWindow, ChatMessage, ChatInput, QuickStarters
    │   ├── office/           # OfficeScene (THE OFFICE card), OfficeDebug
    │   ├── layout/           # Header, BrailleBanner, EmergencyBanner, QuoteBar,
    │   │                     #   StatusPills, ToastNotification
    │   ├── modals/           # Bureaucracy, Vision, OrgAbout, Toolkit, Report,
    │   │                     #   ThemeGatekeeper, GrandFinale, ApologyPdf,
    │   │                     #   LanguageWheel, EmotionalSupport, InfiniteLoading, ...
    │   ├── accessibility/    # SignLanguageWidget
    │   └── common/           # RetroDarkLogo, SampleIllustrationSVG
    │
    ├── constants/            # departments, captcha + legal math, vision samples,
    │                         #   quotes, accessibility data, office (roster, stations,
    │                         #   scenes, nav, occluders, poses, dialogue)
    ├── contexts/
    │   └── StuPDTContext.jsx # Global state: theme, a11y, metrics, modals, sound
    ├── hooks/                # useChat, useVisionScan, useAudio, useMetrics,
    │                         #   useTheme, useToast, useOfficeEngine
    ├── i18n/                 # Wheel of Languages: language registry, translate(),
    │                         #   pigLatin, spinMath, translations/catalog/*
    ├── services/             # apiClient, chatService, gemini, bureaucracyService,
    │                         #   telemetryService, conversationEngine (intent, routing,
    │                         #   offline replies) + replyPools + offlineReplies (+ .test.js)
    ├── utils/                # braille.js, soundEngine.js (Web Audio synthesis)
    │   └── office/           # THE OFFICE simulation: engine, actor, director,
    │                         #   activities, pathing, props, bubbles, dialogue,
    │                         #   atlas, rng, timing
    └── styles/index.css
```

### Architecture at a glance

- **State:** One `StuPDTContext` holds theme, Braille/sign-language modes, mute, metrics and the active modal. Chat state lives in the `useChat` hook.
- **Persistence:** Chat history, metrics and VIP status are kept in `sessionStorage`, so a refresh keeps your suffering. The ErrorBoundary offers a _Clear Corrupted Storage & Reload_ button.
- **Resilience:** Every network call fails soft. 401/403/404/405 responses short-circuit straight to the offline fallback instead of retrying.
- **i18n:** The Wheel of Languages picks the active language at random; UI strings go through `src/i18n/translate.js` with per-feature catalogs, and untranslated strings fall back to English.
- **Sound:** All audio is synthesized with the Web Audio API in `soundEngine.js`. There are no audio files to load.
- **THE OFFICE:** DOM sprites in a 1672×941 world scaled by one transform. One `requestAnimationFrame` loop writes transforms imperatively, with no React state per frame. A fixed-timestep simulation handles A* pathing, a scene director and the huddle choreography, and furniture occludes sprites through y-sorted, clipped copies of the office image. Huddles are derived from `messages`, so `useChat` is untouched.

---

## Tech stack

|             |                                                               |
| ----------- | ------------------------------------------------------------- |
| **UI**      | React 19, Lucide icons                                        |
| **Styling** | Tailwind CSS 3.4, PostCSS, Autoprefixer                       |
| **Tooling** | Vite+ (`vp`), TypeScript, pnpm                                |
| **AI**      | Google Gemini (chat + structured-JSON vision), fully optional |

---

## Design language

Two posters, one toggle. The theme names come from the in-app copy.

|                | 🌑 Dark (default)                        | ☀️ Light ("Alpine Sky")          |
| -------------- | ---------------------------------------- | -------------------------------- |
| **Background** | `#08080A` with a crosshair grid          | `#3888F2`                        |
| **Accents**    | `#0EC7F5` `#1FE03F` `#FF6B1A` `#F52820`  | `#FFE600` `#071638`              |
| **Vibe**       | Retro-OS window chrome, glowing wordmark | Bold outlines, hard drop-shadows |

---

## FAQ

**Does it actually answer questions?**
No. It's the one promise it keeps.

**Why does the tagline say 17 departments but the org chart shows 7?**
Ten departments are currently on an emergency synergy retreat.

**Why can't I close the app?**
Please submit Departure Form 999-B to the Exit Committee.

**Can I get a human?**
The Human Department is currently being replaced by AI.

---

<div align="center">

**StuPDT™ · Stupid. Fast. Wrong. · MALFUNCTION 2026**

_We apologize for the inconvenience caused by our previous inconvenience._

</div>
