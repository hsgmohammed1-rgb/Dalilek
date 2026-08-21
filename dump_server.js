const http = require('http');
const fs = require('fs');
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      fs.writeFileSync('dom_dump.html', body);
      res.end('ok');
      console.log('Dump received!');
      process.exit(0);
    });
  }
});
server.listen(5001, () => {
  console.log('Listening on 5001 for dump...');
});
