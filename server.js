import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files with extensions (.css, .js, .png, etc.)
app.use(express.static(__dirname));

// Custom middleware to resolve clean URLs (e.g., /about -> /about.html)
app.use((req, res, next) => {
  const ext = path.extname(req.path);
  if (!ext && req.path !== '/') {
    const htmlPath = path.join(__dirname, req.path + '.html');
    res.sendFile(htmlPath, (err) => {
      if (err) {
        next();
      }
    });
  } else {
    next();
  }
});

// For any other route, fallback to index.html (or send 404)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
