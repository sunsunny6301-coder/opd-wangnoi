// ── Serverless proxy สำหรับผู้ช่วย AI ในเว็บ (Vercel function, ไม่มี dependency) ──
// หน้าที่: ถือ ANTHROPIC_API_KEY ไว้ฝั่งเซิร์ฟเวอร์ (ห้ามให้ key หลุดไปเบราว์เซอร์)
// แล้ว forward คำขอไปยัง Claude Messages API ให้ ตัว tool ทั้งหมดทำงานในเบราว์เซอร์
// (ดู src/agent.jsx) — function นี้แค่ส่งข้อความผ่านเท่านั้น ไม่เก็บ state
//
// ตั้งค่าใน Vercel → Project → Settings → Environment Variables:
//   ANTHROPIC_API_KEY = sk-ant-...   (จำเป็น)
//   CLAUDE_MODEL       = claude-opus-4-8   (ไม่ใส่ก็ได้ — ค่า default นี้)
//                        จะประหยัดกว่าใช้ claude-haiku-4-5 / claude-sonnet-4-6 ก็ได้

module.exports = async (req, res) => {
  // health check
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, hasKey: !!process.env.ANTHROPIC_API_KEY });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Vercel (Settings → Environment Variables) แล้ว redeploy' });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};
    const { system, messages, tools, model } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'ต้องมี messages' });
      return;
    }
    const payload = {
      model: model || process.env.CLAUDE_MODEL || 'claude-opus-4-8',
      max_tokens: 1024,
      // effort ต่ำ = ตอบเร็ว/ถูก เหมาะกับผู้ช่วยตอบแชต (ปรับเป็น medium/high ได้ถ้าต้องการฉลาดขึ้น)
      output_config: { effort: 'low' },
      messages,
    };
    if (system) payload.system = system;
    if (Array.isArray(tools) && tools.length) payload.tools = tools;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
