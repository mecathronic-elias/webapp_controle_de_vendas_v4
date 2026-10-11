// Função serverless (Vercel): guarda todos os dados do app no Upstash Redis.
const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'vendas:db';
const cmd = async (c) => {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(c) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pw = process.env.APP_PASSWORD;
  if (!pw || !URL_ || !TOK) return res.status(500).json({ error: 'Servidor não configurado (APP_PASSWORD / Redis).' });
  const a = Buffer.from(String(req.headers['x-auth'] || '')), b = Buffer.from(pw);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const cur = JSON.parse((await cmd(['GET', KEY])) || 'null') || { rev: 0, data: null };
    if (req.method === 'GET') return res.status(200).json(cur);
    if (req.method === 'PUT') {
      const { rev, data } = req.body || {};
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'dados inválidos' });
      if (rev !== -1 && rev !== cur.rev) return res.status(409).json(cur);
      const n = { rev: cur.rev + 1, data };
      await cmd(['SET', KEY, JSON.stringify(n)]);
      return res.status(200).json({ rev: n.rev });
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
