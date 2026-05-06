export interface Env {
    STRAVA_CLIENT_ID: string;
    STRAVA_CLIENT_SECRET: string;
    STRAVA_REFRESH_TOKEN: string;
    STRAVA_ATHLETE_ID: string;
    STRAVA_TOKEN_CACHE: KVNamespace;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            if (path === '/strava/stats') {
                return await handleStravaStats(env, corsHeaders);
            }

            if (path === '/strava/activities') {
                return await handleStravaActivities(request, env, corsHeaders);
            }

            return new Response('Not found', { status: 404, headers: corsHeaders });
        } catch (err: any) {
            console.error('Worker error:', err);
            return new Response(
                JSON.stringify({ error: 'Internal server error' }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }
    },
};

// ==================== TOKEN MANAGEMENT WITH KV ====================

async function getValidAccessToken(env: Env): Promise<string> {
    const TOKEN_KEY = 'strava_access_token';
    const EXPIRY_KEY = 'strava_token_expires_at';

    const cachedToken = await env.STRAVA_TOKEN_CACHE.get(TOKEN_KEY);
    const cachedExpiry = await env.STRAVA_TOKEN_CACHE.get(EXPIRY_KEY);

    const now = Math.floor(Date.now() / 1000);

    if (cachedToken && cachedExpiry && parseInt(cachedExpiry) > now) {
        console.log('Using cached Strava token');
        return cachedToken;
    }

    console.log('Refreshing Strava access token...');

    const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.STRAVA_CLIENT_ID,
            client_secret: env.STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: env.STRAVA_REFRESH_TOKEN,
        }),
    });

    if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(`Failed to refresh Strava token: ${refreshResponse.status} - ${errorText}`);
    }

    const tokenData = await refreshResponse.json();

    if (!tokenData.access_token) {
        throw new Error('Invalid token response from Strava');
    }

    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    await env.STRAVA_TOKEN_CACHE.put(TOKEN_KEY, tokenData.access_token);
    await env.STRAVA_TOKEN_CACHE.put(EXPIRY_KEY, expiresAt.toString());

    console.log('Strava token refreshed successfully');
    return tokenData.access_token;
}

// ==================== HANDLERS ====================

async function handleStravaStats(env: Env, corsHeaders: Record<string, string>) {
    const accessToken = await getValidAccessToken(env);

    const response = await fetch(`https://www.strava.com/api/v3/athletes/${env.STRAVA_ATHLETE_ID}/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

async function handleStravaActivities(request: Request, env: Env, corsHeaders: Record<string, string>) {
    const accessToken = await getValidAccessToken(env);
    const url = new URL(request.url);

    const stravaUrl = `https://www.strava.com/api/v3/athlete/activities${url.search}`;

    const response = await fetch(stravaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}