import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const port = process.env.PORT || 8811;

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon'
};

function serveFile(fp, res) {
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(fp);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const rawPath = decodeURIComponent(req.url.split('?')[0]);
  let p = rawPath;
  if (p === '/') p = '/index.html';
  const fp = path.join(root, p);
  // Sem extensão (ex.: /admin) -> se for uma pasta de verdade, redireciona pra
  // com barra no final (/admin/) antes de servir o index.html dela. Sem isso,
  // os <link>/<script> com caminho relativo (css/admin.css etc.) resolvem
  // errado, contra a raiz do site em vez da pasta admin/ — página sai toda
  // desestilizada. GitHub Pages já faz esse redirecionamento sozinho; esse
  // servidor de teste local não fazia.
  if (!path.extname(fp)) {
    fs.access(fp, fs.constants.F_OK, (dirErr) => {
      if (!dirErr) {
        if (!rawPath.endsWith('/')) {
          res.writeHead(302, { Location: rawPath + '/' });
          res.end();
          return;
        }
        return serveFile(path.join(fp, 'index.html'), res);
      }
      serveFile(fp, res);
    });
    return;
  }
  serveFile(fp, res);
}).listen(port, () => console.log(`listening on ${port}`));
