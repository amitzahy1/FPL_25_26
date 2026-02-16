export default {
  async fetch(request) {
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('url');
    
    // Whitelist only FPL domains to prevent abuse
    const allowed = [
      'https://fantasy.premierleague.com',
      'https://draft.premierleague.com'
    ];
    
    if (!endpoint || !allowed.some(base => endpoint.startsWith(base))) {
      return new Response('Forbidden: This proxy only allows access to FPL APIs.', { status: 403 });
    }
    
    // Use Cloudflare's powerful caching
    const response = await fetch(endpoint, {
      cf: {
        cacheTtl: 300, // Cache for 5 minutes
        cacheEverything: true
      }
    });
    
    // Re-create the response to add our own headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Cache-Control', 'public, max-age=300');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
}
