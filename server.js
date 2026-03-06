import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(express.json({ limit: '1mb' }));

// ===== Translation API Proxy (CORS 우회) =====
app.post('/api/translate', async (req, res) => {
  const { provider, apiKey, body } = req.body;

  if (!provider || !apiKey || !body) {
    return res.status(400).json({ error: 'provider, apiKey, body 필수' });
  }

  try {
    let url, headers;

    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
    } else {
      return res.status(400).json({ error: '지원하지 않는 provider' });
    }

    const apiRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return res.status(apiRes.status).json(data);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' });
  }
});

// Serve static files under /Zeeco/ base path (matches vite.config base)
app.use('/Zeeco', express.static(join(__dirname, 'dist'), { maxAge: '1d' }));

// Redirect root to /Zeeco/
app.get('/', (_req, res) => {
  res.redirect('/Zeeco/');
});

// SPA fallback - all routes under /Zeeco serve index.html (Express 5 syntax)
app.get('/Zeeco/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n  Zeeco Project Management Dashboard`);
  console.log(`  -----------------------------------`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  http://0.0.0.0:${PORT}`);
  console.log(`\n  외부 접속: http://<서버IP>:${PORT}\n`);
});
