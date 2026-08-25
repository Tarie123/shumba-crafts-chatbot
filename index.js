/**
 * Shumba Crafts — WhatsApp Business Cloud API Chatbot
 * ----------------------------------------------------
 * Handles incoming WhatsApp messages for shumbacrafts.co.zw:
 * - Welcome + main menu (interactive buttons/list)
 * - Collection browsing (Wood, Sculpture, Metalwork, Pottery)
 * - Commission enquiries
 * - Shipping, payment, hours/location FAQs
 * - Keyword fallback matching
 * - Human agent handoff (routes to staff WhatsApp number)
 *
 * Requires: Node.js 18+, a Meta WhatsApp Business Cloud API app,
 * a verified phone number, and a permanent access token.
 */

const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// ---------- Config ----------
const {
  VERIFY_TOKEN, // arbitrary string you choose, used in Meta webhook setup
  WHATSAPP_TOKEN, // permanent access token from Meta App
  PHONE_NUMBER_ID, // from WhatsApp > API Setup in Meta dashboard
  AGENT_WHATSAPP_NUMBER, // staff number to forward handoffs to, e.g. 263772337808
  PORT = 3000,
} = process.env;

const GRAPH_API = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

// ---------- In-memory session store ----------
// For production, swap this Map for Redis (see README).
const sessions = new Map();
function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, { stage: "menu", lastActive: Date.now() });
  }
  return sessions.get(from);
}

// ---------- Business data (from shumbacrafts.co.zw) ----------
const BUSINESS = {
  name: "Shumba Crafts",
  tagline: "Heritage in Wood — Handmade in Zimbabwe, Est. 2018",
  location: "Harare, Zimbabwe",
  hours: "Mon–Sat, 8:00 AM – 5:00 PM (Africa/Harare, CAT)",
  agentNumber: AGENT_WHATSAPP_NUMBER,
  facebook: "https://www.facebook.com/profile.php?id=100063900227062",
  channel: "https://whatsapp.com/channel/0029VbAwgHb42DcX8PL6MI0n",
  categories: {
    wood: {
      label: "🪵 Wood Carvings",
      text:
        "Hand-carved ironwood, mopane & jacaranda pieces — including the Elephant Kist storage chest and carved side tables with relief mandalas. No power tools touch the final surface; every piece is signed with a Certificate of Authenticity.",
    },
    sculpture: {
      label: "🗿 Sculpture (Stone)",
      text:
        "One-of-one serpentine stone sculptures, hand-carved over weeks — including the Resting Hippo and Woman of Stone. Large-scale, outdoor-ready pieces.",
    },
    metalwork: {
      label: "🔩 Metalwork",
      text:
        "Recycled & forged metal art — painted birds, the Iron Rooster, wire-wrapped Zebra Herd, and forged Iron Bloom sculptures. Garden and courtyard favourites.",
    },
    pottery: {
      label: "🏺 Pottery",
      text:
        "Wheel-thrown terracotta and stoneware — the Savannah Tea Set, Midnight Vase, Floor Vase Collection, and Wall Pocket Vase. Functional and decorative.",
    },
  },
};

// ---------- Send helpers ----------
async function sendRequest(payload) {
  try {
    await axios.post(GRAPH_API, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("WhatsApp send error:", err.response?.data || err.message);
  }
}

function textPayload(to, body) {
  return { messaging_product: "whatsapp", to, type: "text", text: { body } };
}

async function sendText(to, body) {
  return sendRequest(textPayload(to, body));
}

async function sendMainMenu(to) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: `${BUSINESS.name} 🦁` },
      body: {
        text: `${BUSINESS.tagline}\n\nHow can we help you today?`,
      },
      footer: { text: "Reply anytime with 'menu' to see this again" },
      action: {
        button: "View Options",
        sections: [
          {
            title: "Shumba Crafts",
            rows: [
              { id: "collection", title: "🖼️ Browse Collection", description: "Wood, stone, metal & pottery" },
              { id: "commission", title: "✍️ Commission a Piece", description: "Custom size, wood & subject" },
              { id: "shipping", title: "🚚 Shipping & Delivery", description: "Rates and timelines" },
              { id: "payment", title: "💳 Payment Options", description: "How to pay" },
              { id: "hours", title: "📍 Hours & Location", description: "Where & when to find us" },
              { id: "agent", title: "🙋 Talk to a Human", description: "Connect with our team" },
            ],
          },
        ],
      },
    },
  };
  return sendRequest(payload);
}

async function sendCollectionMenu(to) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "Our Collection" },
      body: { text: "Every piece is handmade in Zimbabwe. Pick a category to learn more:" },
      action: {
        button: "Categories",
        sections: [
          {
            title: "Categories",
            rows: [
              { id: "cat_wood", title: BUSINESS.categories.wood.label },
              { id: "cat_sculpture", title: BUSINESS.categories.sculpture.label },
              { id: "cat_metalwork", title: BUSINESS.categories.metalwork.label },
              { id: "cat_pottery", title: BUSINESS.categories.pottery.label },
              { id: "menu", title: "⬅️ Back to Main Menu" },
            ],
          },
        ],
      },
    },
  };
  return sendRequest(payload);
}

// ---------- Message handlers ----------
async function handleMenuSelection(from, id) {
  switch (id) {
    case "collection":
      await sendCollectionMenu(from);
      break;

    case "cat_wood":
    case "cat_sculpture":
    case "cat_metalwork":
    case "cat_pottery": {
      const key = id.replace("cat_", "");
      const cat = BUSINESS.categories[key];
      await sendText(
        from,
        `${cat.label}\n\n${cat.text}\n\nSee photos and prices, or enquire about a specific piece, on our full catalog:\nhttps://shumbacrafts.co.zw/#collection\n\nWant to commission something similar? Reply "commission".`
      );
      break;
    }

    case "commission":
      await sendText(
        from,
        "We'd love to make something for you. Please share:\n1️⃣ Wood/material type (e.g. ironwood, jacaranda, stone, metal)\n2️⃣ Size\n3️⃣ Subject or design idea\n\nA member of our team will confirm timeline and pricing within 24 hours."
      );
      getSession(from).stage = "commission";
      break;

    case "shipping":
      await sendText(
        from,
        "🚚 Shipping & Delivery\n\nWe ship locally within Zimbabwe and internationally. Delivery timelines and rates depend on piece size and destination — send us the item and your location and we'll confirm a quote right away."
      );
      break;

    case "payment":
      await sendText(
        from,
        "💳 Payment Options\n\nWe accept cash, bank transfer, and mobile money (EcoCash/OneMoney) for local orders, and international transfer for overseas orders. Full payment details are confirmed once your order is agreed with our team."
      );
      break;

    case "hours":
      await sendText(
        from,
        `📍 Hours & Location\n\n${BUSINESS.hours}\nBased in ${BUSINESS.location}.\n\nFollow us:\nFacebook: ${BUSINESS.facebook}\nWhatsApp Channel: ${BUSINESS.channel}`
      );
      break;

    case "agent":
      await routeToAgent(from);
      break;

    case "menu":
    default:
      await sendMainMenu(from);
      break;
  }
}

async function routeToAgent(from) {
  await sendText(
    from,
    "Connecting you with our team — someone will reply here shortly. In the meantime, feel free to describe what you're looking for."
  );
  getSession(from).stage = "with_agent";
  if (BUSINESS.agentNumber) {
    await sendText(
      `${BUSINESS.agentNumber}`,
      `🔔 New customer handoff request from ${from}. Please reply to them directly on WhatsApp.`
    );
  }
}

// Simple keyword fallback for free-text messages
function matchKeyword(text) {
  const t = text.toLowerCase();
  if (/(wood|carv|ironwood|jacaranda|mopane|kist|table)/.test(t)) return "cat_wood";
  if (/(stone|sculpt|hippo|serpentine)/.test(t)) return "cat_sculpture";
  if (/(metal|steel|zebra|rooster|bird|iron bloom)/.test(t)) return "cat_metalwork";
  if (/(pottery|clay|vase|tea set|ceramic)/.test(t)) return "cat_pottery";
  if (/(commission|custom|bespoke|order)/.test(t)) return "commission";
  if (/(ship|deliver|courier)/.test(t)) return "shipping";
  if (/(pay|price|cost|how much)/.test(t)) return "payment";
  if (/(hour|open|location|address|where)/.test(t)) return "hours";
  if (/(agent|human|staff|person|talk to someone)/.test(t)) return "agent";
  if (/(menu|hi|hello|hey|start)/.test(t)) return "menu";
  return null;
}

// ---------- Webhook verification (GET) ----------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------- Webhook receiver (POST) ----------
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // acknowledge immediately, Meta requires <5s response

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    if (!message) return; // e.g. delivery/read receipts, ignore

    const from = message.from; // customer's WhatsApp number
    getSession(from).lastActive = Date.now();

    if (message.type === "interactive") {
      const id =
        message.interactive?.list_reply?.id ||
        message.interactive?.button_reply?.id;
      if (id) await handleMenuSelection(from, id);
      return;
    }

    if (message.type === "text") {
      const body = message.text.body.trim();
      const session = getSession(from);

      // If a human agent is already engaged, don't auto-reply — just log.
      if (session.stage === "with_agent") return;

      // If mid-commission flow, forward details to agent and confirm.
      if (session.stage === "commission") {
        await sendText(from, "Got it — thank you! Our team will follow up shortly with pricing and timeline.");
        if (BUSINESS.agentNumber) {
          await sendText(
            BUSINESS.agentNumber,
            `📝 Commission enquiry from ${from}:\n"${body}"`
          );
        }
        session.stage = "menu";
        return;
      }

      const matched = matchKeyword(body);
      if (matched) {
        await handleMenuSelection(from, matched);
      } else {
        await sendText(
          from,
          "Thanks for reaching out to Shumba Crafts! 🦁 I didn't quite catch that — type 'menu' to see all options, or ask about wood, stone, metal, pottery, commissions, shipping, or payment."
        );
      }
      return;
    }
  } catch (err) {
    console.error("Webhook handling error:", err);
  }
});

app.get("/", (req, res) => res.send("Shumba Crafts WhatsApp bot is running."));

app.listen(PORT, () => {
  console.log(`Shumba Crafts WhatsApp bot listening on port ${PORT}`);
});
