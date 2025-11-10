// Simplified FPL Draft Picks API - bypasses CORS
// Usage: /api/draft-picks?entryId=1889&event=11

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { entryId, event } = req.query;

    if (!entryId) {
        return res.status(400).json({ error: 'entryId is required' });
    }

    // Default to event 11 if not provided
    const gameweek = event || '11';

    try {
        console.log(`[draft-picks] Fetching picks for entry ${entryId}, GW ${gameweek}`);
        
        const url = `https://draft.premierleague.com/api/entry/${entryId}/event/${gameweek}`;
        
        // Try with different header combinations
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://draft.premierleague.com/',
                'Origin': 'https://draft.premierleague.com',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        });

        console.log(`[draft-picks] Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[draft-picks] FPL API error: ${response.status} - ${errorText.substring(0, 200)}`);
            throw new Error(`FPL API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`[draft-picks] ✅ Success: ${data.picks?.length || 0} picks for entry ${entryId}`);
        
        return res.status(200).json(data);
        
    } catch (error) {
        console.error('Error fetching draft picks:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch draft picks',
            message: error.message,
            entryId: entryId,
            event: gameweek
        });
    }
}

