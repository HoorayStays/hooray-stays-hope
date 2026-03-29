const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.get('/', (req, res) => {
  res.json({ status: 'Hope is online', version: '1.0' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system } = req.body;
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: system,
      messages,
    });
    const replyText = response.content[0].text;
    const leadMatch = replyText.match(/<lead_data>([\s\S]*?)<\/lead_data>/);
    if (leadMatch) sendLeadEmail(leadMatch[1]).catch(console.error);
    res.json({ content: [{ text: replyText }] });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/lead', async (req, res) => {
  try {
    await sendLeadEmail(null, req.body.fields);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Email failed' });
  }
});

async function sendLeadEmail(rawData, fields = null) {
  if (rawData && !fields) {
    fields = {};
    rawData.split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx > -1) fields[line.slice(0,idx).trim()] = line.slice(idx+1).trim();
    });
  }
  if (!fields || !fields.email || fields.email === 'none') return;
  const fitEmoji = fields.fit === 'green' ? '✅' : fields.fit === 'caution' ? '⚠️' : '❌';
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await transporter.sendMail({
    from: `"Hope – Hooray Stays" <${process.env.EMAIL_USER}>`,
    to: 'info@hooray-stays.com',
    subject: `🏡 New Lead — ${fields.name || 'Unknown'} | ${fields.address || 'No address'} | ${fields.bedrooms || '?'}BR`,
    text: `NEW LEAD FROM HOPE\n\nName: ${fields.name}\nEmail: ${fields.email}\nPhone: ${fields.phone}\nAddress: ${fields.address}\nBedrooms: ${fields.bedrooms}\nBathrooms: ${fields.bathrooms}\nGuests: ${fields.guests}\nPool: ${fields.pool}\nHot Tub: ${fields.hottub}\nStatus: ${fields.status}\nEarnings: ${fields.earnings}\nPain Point: ${fields.pain_point}\nHands Off: ${fields.hands_off}\n\nFit: ${fitEmoji} ${fields.fit}\n${fields.fit_reason}\n\nCall Booked: ${fields.call_booked}`
  });
}

const PORT = process.env.PORT || 3000;
setInterval(() => {
  require('http').get(`http://localhost:${PORT}/`, () => {}).on('error', () => {});
}, 14 * 60 * 1000);

app.listen(PORT, () => console.log(`Hope backend running on port ${PORT}`));
