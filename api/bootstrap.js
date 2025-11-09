// Vercel Serverless Function - FPL Bootstrap API
// This function fetches data from FPL API and returns it with CORS headers

export default async function handler(req, res) {
    // Set CORS headers to allow requests from your GitHub Pages site
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        console.log('Fetching FPL bootstrap data...');
        
        const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`FPL API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`✅ Successfully fetched ${data.elements?.length || 0} players`);
        
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching FPL data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch FPL data',
            message: error.message 
        });
    }
}

