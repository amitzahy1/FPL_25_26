// Vercel Serverless Function - FPL Bootstrap API
// This function fetches data from FPL API and returns it with CORS headers

export default async function handler(req, res) {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('Fetching FPL Draft bootstrap data...');
        
        // ✅ Use Draft API instead of Fantasy API to get all draft players
        const response = await fetch('https://draft.premierleague.com/api/bootstrap-static', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`FPL Draft API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`✅ Successfully fetched ${data.elements?.length || 0} draft players`);
        
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching FPL Draft data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch FPL Draft data',
            message: error.message 
        });
    }
}

