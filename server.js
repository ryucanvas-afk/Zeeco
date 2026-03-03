import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(express.static(join(__dirname, 'dist'), { maxAge: '1d' }));

// SPA fallback - all routes serve index.html (Express 5 syntax)
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n  Zeeco Project Management Dashboard`);
  console.log(`  -----------------------------------`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  http://0.0.0.0:${PORT}`);
  console.log(`\n  외부 접속: http://<서버IP>:${PORT}\n`);
});
