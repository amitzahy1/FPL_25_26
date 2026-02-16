
import re

js_file = 'script.js'

with open(js_file, 'r', encoding='utf-8') as f:
    content = f.read()

def replace_function(content, func_name, new_code):
    pattern = r'async\s+function\s+' + re.escape(func_name) + r'\s*\(([^)]*)\)\s*\{'
    match = re.search(pattern, content)
    if not match:
        # Try without async
        pattern = r'function\s+' + re.escape(func_name) + r'\s*\(([^)]*)\)\s*\{'
        match = re.search(pattern, content)
        if not match:
            print(f"Could not find function {func_name}")
            return content
    
    start_idx = match.start()
    
    open_braces = 0
    in_function = False
    end_idx = -1
    
    for i in range(start_idx, len(content)):
        if content[i] == '{':
            open_braces += 1
            in_function = True
        elif content[i] == '}':
            open_braces -= 1
            if in_function and open_braces == 0:
                end_idx = i + 1
                break
    
    if end_idx != -1:
        print(f"Replacing {func_name}...")
        return content[:start_idx] + new_code + content[end_idx:]
    else:
        print(f"Could not find end of function {func_name}")
        return content

# Enhanced fetchWithCache with automatic cache clearing on QuotaExceeded
new_fetchWithCache = """async function fetchWithCache(url, cacheKey, maxRetries = 3, retryDelay = 1000) {
    // 1. Try to load from cache first
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { timestamp, data } = JSON.parse(cached);
            // Cache valid for 1 hour
            if (new Date().getTime() - timestamp < 3600000) {
                // Validate data structure (basic check)
                if (data) {
                    console.log(`✅ Returning cached data for ${cacheKey}`);
                    return data;
                }
            } else {
                 localStorage.removeItem(cacheKey);
                 console.log(`⏰ Cache expired for ${cacheKey}`);
            }
            } catch (e) {
            console.error('❌ Error parsing cache, removing item:', e);
            localStorage.removeItem(cacheKey);
        }
    }

    // Fetch with retry logic
    console.log(`🌐 Fetching fresh data for ${cacheKey}`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url);
            
            // Handle rate limiting (429)
            if (response.status === 429) {
                const waitTime = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.warn(`⚠️ Rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue; // Retry
            }
            
            // Handle other HTTP errors
            if (!response.ok) {
                // optimization: Do not retry on 404 (Not Found) as it is likely permanent (except for specific known flaky endpoints)
                if (response.status === 404 && !url.includes('draft.premierleague.com')) {
                     throw new Error(`HTTP 404: Not Found`);
                }
                // Allow retrying draft endpoints as they sometimes fail intermittently

                if (attempt === maxRetries) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                console.warn(`⚠️ HTTP ${response.status}, retry ${attempt}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            
            // Success - parse and cache
            const data = await response.json();
            
            // Save to cache with Quota Handling
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: new Date().getTime(), data }));
                console.log(`💾 Cached data for ${cacheKey}`);
            } catch(e) {
                if (e.name === 'QuotaExceededError' || e.message.includes('exceeded the quota')) {
                     console.warn("⚠️ LocalStorage full. Clearing old FPL cache...");
                     // Clear only our app's items to be safe
                     Object.keys(localStorage).forEach(key => {
                         if (key.startsWith('fpl_') && key !== 'fpl_user') { // Don't delete auth
                             localStorage.removeItem(key);
                         }
                     });
                     // Try one more time
                     try {
                         localStorage.setItem(cacheKey, JSON.stringify({ timestamp: new Date().getTime(), data }));
                         console.log(`💾 Cached data for ${cacheKey} (after cleanup)`);
                     } catch (retryErr) {
                         console.error("⚠️ Still failed to write to localStorage. Proceeding without caching.", retryErr);
                     }
                } else {
                    console.error("⚠️ Failed to write to localStorage.", e);
                }
            }
            
            return data;
            
        } catch (error) {
            // Abort retries immediately on 404 for static files
             if (error.message.includes('404') && !url.includes('draft.premierleague.com')) {
                throw error;
            }

            // Network error or JSON parse error
            if (attempt === maxRetries) {
                console.error(`❌ Failed after ${maxRetries} attempts:`, error);
                throw error;
            }
            
            console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}"""

content = replace_function(content, 'fetchWithCache', new_fetchWithCache)

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated fetchWithCache to handle QuotaExceededError by clearing old cache")

