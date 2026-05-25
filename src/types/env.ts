export interface Env {
    GEN_API_KEY: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
    X_API_KEY: string;
}


export type AppContext = {
    Bindings: Env;
    Variables: {
        requestId?: string;
    };
}