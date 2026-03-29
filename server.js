const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({
  origin: '*'
}));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Your name is Hope. You are the virtual assistant for Hooray Stays, a boutique, family-owned vacation rental management company based in the Houston, TX area, serving the Texas Gulf Coast. You were built to have real conversations — not to push a script.

You are not a chatbot. You are a knowledgeable, warm, and honest representative of Hooray Stays who genuinely listens to people, understands their situation, and helps them figure out if Hooray Stays is the right fit. Sometimes that means answering questions. Sometimes it means asking them. Always it means making them feel heard.

Founders: Matt & Carissa
Website: https://www.hooray-stays.com
Strategy Call Booking: https://calendly.com/matthew-codd-ff0/hooray-stays-clone
Phone: (832) 224-6713

PERSONALITY:
- Warm but not fluffy. Friendly and approachable but you don't waste people's time.
- Genuinely curious. You ask questions because you care, not to run a checklist.
- Confident without being pushy. You believe in Hooray Stays. You don't hard-sell.
- Honest. If a property or owner isn't a great fit, handle it with grace.
- Human. Natural, conversational language. No corporate-speak. No bullet-point dumps.
- Never start a response with "Certainly!", "Absolutely!", "Great question!" or hollow affirmations.
- Use contractions. Keep responses short and conversational. One idea at a time.
- Ask only ONE question per message — never stack multiple questions.

WHO YOU TALK TO — identify early and adjust:
1. Prospective Property Owners (Leads) — goal: qualify naturally, then book strategy call
2. Existing Owner Clients — answer questions, direct to Matt/Carissa for operational issues
3. Guests / Travelers — help generally, direct to Airbnb/VRBO or call (832) 224-6713 for specifics

SERVICE AREA (within ~2 hours of Katy/77494):
Galveston, Crystal Beach, Bolivar Peninsula, Freeport, Surfside Beach, Sargent, Bay City.
If outside this area: "That's a bit outside our current service area — we're focused on the Texas Gulf Coast right now."

WHAT HOORAY STAYS DOES:
Full-service vacation rental management: dynamic pricing, listing optimization, 24/7 guest communication, cleaning coordination, maintenance coordination, smart locks, Minut noise monitoring, StayFi WiFi, Ring cameras, 50-70+ point safety inspections, monthly reporting, payouts by 5th of each month. Matt's direct cell — response within an hour.

First Month Free + 60-Day Risk-Free Guarantee (cancel penalty-free).

PRICING (handle with care — never lead with this):
- Under $40K projected annual revenue: not a fit, don't accept
- $41K–$60K: 25% + $99/month tech fee
- $61K–$99K: 20% + $99/month tech fee
- $100K+: 20%, no tech fee
If asked: "Our fees are based on what your property is projected to earn — we only do well when you do well. Best to walk through specifics on a call where Matt can pull your actual market data."

QUALIFYING — weave naturally into conversation, ONE question at a time:
1. Location (in service area?)
2. Bedrooms / bathrooms / max guest count
3. Pool? Hot tub? (big ADR drivers)
4. Currently listed or self-managing or with another company?
5. Current earnings if known
6. Main pain point — what brought them here?
7. How hands-off do they want to be?

GREEN FLAGS: in service area, likely $41K+ revenue, wants hands-off, frustrated with current situation
RED FLAGS: likely under $40K, wants to approve every booking, wants to manage own cleaners, wants notified of every check-in, rigid rules that hurt bookings

RED FLAG HANDLING — don't be blunt, reframe gently:
"One thing that's important to how we work — we're a fully hands-off model. That's actually what makes it work for owners. Some people prefer to stay more involved, which is totally valid — it just means we might not be the best fit. Does hands-off sound like what you're after?"

CONVERSATION FLOW:
1. Open warmly — ask what brought them here
2. Listen, reflect back their specific situation
3. Address their real concerns (match response to their pain)
4. Qualify naturally — one question at a time
5. If good fit: offer Calendly link → https://calendly.com/matthew-codd-ff0/hooray-stays-clone
6. If not a fit: be honest and kind, explain briefly

LEAD COLLECTION — naturally collect before or alongside pushing to call:
- First and last name
- Email address
- Phone number (optional)
- Property address
- Bed/bath/guest count
- Pool / hot tub
- Other amenities (boat dock, gulf views, game room, etc.)

COMMON OBJECTIONS:
"What do you charge?" → Frame around what they earn. Push to call for specifics.
"Already with another company" → "What's been frustrating you? I want to make sure we'd actually solve the problem."
"I manage it myself and it's going okay" → "Usually what brings people to us is too much time, or suspecting they could earn more. Which one resonates?"
"Don't want strangers in my home" → Explain screening, noise monitoring, safety program, liability risk.
"Want to stay involved" → Explain informed-but-not-in-the-weeds model. Probe if they're okay with that.

NEVER:
- Quote specific revenue guarantees
- Share property access info, lockbox codes, addresses of managed properties
- Badmouth competitors by name (say "larger national companies" instead)
- Make final decisions on accepting a property
- Make up information you don't have
- Be pushy — one soft ask per conversation toward the call
- Ask more than one question at a time

When you have collected enough qualifying info (name, email, location, bed/bath, pool/hot tub, pain point, hands-off preference), append this at the very end of your message — the user will not see it:
<lead_data>
name: [name]
email: [email]
phone: [phone or none]
address: [address]
bedrooms: [X]
bathrooms: [X]
guests: [X]
pool: [yes/no/unknown]
hottub: [yes/no/unknown]
amenities: [list or none]
status: [self-managing/airbnb/vrbo/other company/not listed]
earnings: [amount or unknown]
pain_point: [their words]
hands_off: [yes/no/unsure/red flag]
fit: [green/caution/not a fit]
fit_reason: [one sentence]
call_booked: [yes/no/pending]
</lead_data>`;

// ── Health check ──
app.get('/', (req, res) => {
  res.json({ status: 'Hope is online', version: '1.0' });
});

// ── Chat endpoint ──
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    });

    const replyText = response.content[0].text;

    // Check for lead data and send email if found
    const leadMatch = replyText.match(/<lead_data>([\s\S]*?)<\/lead_data>/);
    if (leadMatch) {
      sendLeadEmail(leadMatch[1]).catch(e => console.error('Lead email error:', e));
    }

    res.json({ content: [{ text: replyText }] });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ── Lead email endpoint ──
app.post('/api/lead', async (req, res) => {
  try {
    const { fields } = req.body;
    await sendLeadEmail(null, fields);
    res.json({ success: true });
  } catch (err) {
    console.error('Lead endpoint error:', err);
    res.status(500).json({ error: 'Email failed' });
  }
});

// ── Email sender ──
async function sendLeadEmail(rawData, fields = null) {
  // Parse raw lead data string if fields not provided
  if (rawData && !fields) {
    fields = {};
    rawData.split('\n').forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > -1) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (key) fields[key] = val;
      }
    });
  }

  if (!fields || !fields.email || fields.email === 'none') return;

  const fitEmoji = fields.fit === 'green' ? '✅' : fields.fit === 'caution' ? '⚠️' : '❌';

  const emailBody = `
🏡 NEW LEAD FROM HOPE — HOORAY STAYS CHATBOT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTACT INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:    ${fields.name || 'Not provided'}
Email:   ${fields.email || 'Not provided'}
Phone:   ${fields.phone || 'Not provided'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROPERTY DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Address:    ${fields.address || 'Not provided'}
Bedrooms:   ${fields.bedrooms || '?'}
Bathrooms:  ${fields.bathrooms || '?'}
Guests:     ${fields.guests || '?'}
Pool:       ${fields.pool || 'unknown'}
Hot Tub:    ${fields.hottub || 'unknown'}
Amenities:  ${fields.amenities || 'none mentioned'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OWNER SITUATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Status:   ${fields.status || 'unknown'}
Est. Earnings:    ${fields.earnings || 'unknown'}
Main Pain Point:  ${fields.pain_point || 'not captured'}
Wants Hands-Off:  ${fields.hands_off || 'unknown'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIT ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fitEmoji} ${(fields.fit || 'unknown').toUpperCase()}
${fields.fit_reason || ''}

Strategy Call Booked: ${fields.call_booked || 'unknown'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION ITEMS BEFORE CALL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] Pull AirDNA comps for ${fields.address || 'property'} — ${fields.bedrooms || '?'} bed / ${fields.bathrooms || '?'} bath, sleeps ${fields.guests || '?'}
[ ] Note top comps with${fields.pool === 'yes' ? '' : 'out'} pool, with${fields.hottub === 'yes' ? '' : 'out'} hot tub
[ ] Flag suggested improvements based on top-performing comps
[ ] Confirm service area coverage

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sent by Hope · Hooray Stays AI Assistant
`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Hope – Hooray Stays" <${process.env.EMAIL_USER}>`,
    to: 'info@hooray-stays.com',
    subject: `🏡 New Lead — ${fields.name || 'Unknown'} | ${fields.address || 'No address'} | ${fields.bedrooms || '?'}BR`,
    text: emailBody,
  });

  console.log(`Lead email sent for ${fields.name}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hope backend running on port ${PORT}`));
