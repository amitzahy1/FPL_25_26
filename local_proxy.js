const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8010;

// Create a local server to act as a proxy
const server = http.createServer((req, res) => {
        // Enable CORS for everything
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
        }

        // Parse the requested URL
        // Expected format: /?url=https://fantasy.premierleague.com/api/...
        const query = url.parse(req.url, true).query;
        const targetUrl = query.url;

        if (!targetUrl) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Usage: /?url=TARGET_URL');
                return;
        }

        console.log(`Proxying request to: ${targetUrl}`);

        const parsedTarget = url.parse(targetUrl);

        const options = {
                hostname: parsedTarget.hostname,
                path: parsedTarget.path,
                method: 'GET',
                headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': '*/*'
                }
        };

        const proxyReq = https.request(options, (proxyRes) => {
                // Forward status and headers
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (e) => {
                console.error(`Error fetching ${targetUrl}: ${e.message}`);
                res.writeHead(500);
                res.end(`Proxy Error: ${e.message}`);
        });

        proxyReq.end();
});

server.listen(PORT, () => {
        console.log(`=========================================`);
        console.log(`🚀 Local FPL Proxy running on port ${PORT}`);
        console.log(`📡 URL: http://localhost:${PORT}`);
        console.log(`=========================================`);
});
