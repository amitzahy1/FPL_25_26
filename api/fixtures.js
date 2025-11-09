// Vercel Serverless Function - FPL Fixtures API
// This function fetches fixtures data from FPL API

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        console.log('Fetching FPL fixtures data...');
        
        const response = await fetch('https://fantasy.premierleague.com/api/fixtures/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`FPL API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`✅ Successfully fetched ${data.length || 0} fixtures`);
        
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching fixtures data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch fixtures data',
            message: error.message 
        });
    }
}

