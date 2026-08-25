# Shumba Crafts — WhatsApp Business Chatbot

A WhatsApp Cloud API chatbot for [shumbacrafts.co.zw](https://shumbacrafts.co.zw), built with Node.js + Express.

Handles: welcome menu, collection browsing (Wood, Sculpture, Metalwork, Pottery), commission enquiries, shipping/payment/hours FAQs, keyword fallback, and handoff to a human agent.

## 1. Prerequisites

- Node.js 18+
- A Meta Developer account and a WhatsApp Business App: https://developers.facebook.com/apps
- A WhatsApp test/business phone number connected to that app
- A permanent access token (create a System User in Meta Business Settings for a token that doesn't expire in 24h)

## 2. Local setup

```bash
npm install
cp .env.example .env
# edit .env with your WHATSAPP_TOKEN, PHONE_NUMBER_ID, AGENT_WHATSAPP_NUMBER
npm start
```

The server listens on port 3000 (or `PORT` in `.env`).

## 3. Expose it for Meta's webhook (testing)

Meta needs a public HTTPS URL to send messages to. For local testing, use ngrok:

```bash
ngrok http 3000
```

Copy the `https://...ngrok-free.app` URL it gives you.

## 4. Register the webhook in Meta

In your Meta App dashboard → WhatsApp → Configuration:

- **Callback URL**: `https://<your-ngrok-or-domain>/webhook`
- **Verify token**: the same value you set as `VERIFY_TOKEN` in `.env`
- Subscribe to the `messages` webhook field

Meta will call your `/webhook` (GET) to verify — the code already handles this.

## 5. Test it

Send a WhatsApp message to your business number from your phone. You should receive the main menu. Try replying with "wood", "commission", or tapping the list options.

## 6. Going to production

- **Hosting**: deploy to any Node host (Railway, Render, Fly.io, a VPS, etc.) — anywhere that gives you a stable HTTPS URL. Point the Meta webhook Callback URL at your production domain instead of ngrok.
- **Sessions**: this project uses an in-memory `Map` for per-customer session state (fine for one instance / low volume). For multiple server instances or persistence across restarts, swap it for Redis (`ioredis` + a simple get/set wrapper around the `sessions` Map calls in `index.js`).
- **Message templates**: outside the 24-hour customer service window, Meta requires pre-approved template messages to re-initiate contact (e.g. "your commission is ready"). Free-form replies (what this bot sends) only work within 24h of the customer's last message.
- **Rate limits & verification**: for higher message volume, complete Meta Business Verification and request a higher messaging tier.
- **Logging/monitoring**: add a logger (e.g. `pino`) and error alerting before scaling traffic.
- **Security**: verify the `X-Hub-Signature-256` header on incoming webhooks using your App Secret if you handle sensitive data — not included here for simplicity but recommended for production.

## Project structure

```
shumba-whatsapp-bot/
├── index.js          # server, webhook handlers, menu logic
├── package.json
├── .env.example
└── README.md
```

## Known outstanding items

- Webhook signature verification (`X-Hub-Signature-256`) is not yet implemented.
- Session timeout logic (expiring stale `sessions` entries) is not yet implemented.
