import { Context, Next } from 'hono';
import { AppContext } from '../types/env';

// Minimal ambient declaration for `console` to satisfy TS in this workspace
declare const console: { warn(...args: any[]): void; log(...args: any[]): void; error(...args: any[]): void };




export async function validateApiKey(c: Context<AppContext>, next: Next) {
    const apiKey = c.req.header('x-api-key');

    if(!apiKey) {
        return c.json({ success:false, error:'API key is required.' }, 401)
    }

    if (apiKey !== c.env.X_API_KEY) {
        console.warn(`Invalid API Key attempt from IP: ${c.req.header('CF-Connecting-IP')}`);
        return c.json({ success: false, error: 'Invalid API key.' }, 403);
    }
    await next();
}