import { AppContext } from "../types/env";
import { Context } from "hono";
import { AiReport, TextStats } from "../types/report";

// Ambient declarations for runtime globals (keep minimal to avoid changing project TS config)
declare const process: { env: { [key: string]: string | undefined } } | undefined
type RequestInfo = string
type RequestInit = { method?: string; headers?: Record<string, string>; body?: string }
type Response = { ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }
declare function fetch(input: RequestInfo, init?: RequestInit): Promise<Response>




// Types for the stats object returned by processText

/**
 * Send the stats to Gemini (Google Generative Language) API as a prompt and return a textual report.
 * Environment variables used (optional):
 * - GEN_API_KEY: API key for Google Generative Language API
 * - GEN_MODEL: model name (e.g. "models/text-bison-001"). Defaults to "models/text-bison-001" if not set.
 * If the API key is not provided or the request fails, the function returns a local summary report.
 */

export class AIService {

    private c: Context<AppContext>;

    constructor(c: Context<AppContext>) {
        this.c = c;
    }

private cleanAndSplit(text: string): string[] {
    // Kaçış karakterlerini temizle, boşlukları normalize et ve cümleleri ayır
    return text
        .replace(/[\n\r\t]/g, ' ') // Kaçış karakterlerini space'e çevir
        .replace(/\s+/g, ' ') // Birden fazla boşluğu tek boşluğa çevir
        .trim() // Başında sondaki boşlukları sil
        .split('.') // Cümleleri ayır
        .map(s => s.trim()) // Her cümleyi trim et
        .filter(s => s.length > 0); // Boş cümleleri filtrele
}

private processText(text: string, personalInfo: any): TextStats {
    // Count characters in the input string.
    // Assumption: "special characters" = characters that are not letters (any Unicode letter),
    // not digits, and not whitespace. Whitespace is counted separately below but not included in 'special'.
    let uppercase = 0
    let lowercase = 0
    let digits = 0
    let special = 0
    let whitespace = 0

    for (const ch of text) {
        if (/\p{Lu}/u.test(ch)) {
            uppercase++
        } else if (/\p{Ll}/u.test(ch)) {
            lowercase++
        } else if (/\p{Nd}/u.test(ch)) {
            digits++
        } else if (/\s/.test(ch)) {
            whitespace++
        } else {
            special++
        }
    }
    
    let nameOrsurname = (text.toLowerCase().includes(personalInfo.name) || text.toLowerCase().includes(personalInfo.surname))
    let birthDateInfo = personalInfo.birthDate ? personalInfo.birthDate.split('-') : ''
    let hasBirthYear = false;
    if (birthDateInfo) {
        hasBirthYear = text.includes(birthDateInfo[2]) // YYYY
    }

    return {
        upper: uppercase,
        lower: lowercase,
        digits: digits,
        special: special,
        whitespace: whitespace,
        totalLength: text.length,
        includesNameOrSurname: nameOrsurname,
        hasBirthYear: hasBirthYear
    }
}


private getSystemPrompt(): string {
    return [
        'You are a password security expert.',
        'You will receive character statistics describing a user password.',
        'Please evaluate the password personally based on these stats.',
        'First, give a short strength assessment: Strong / Medium / Weak.',
        'Then, provide up to 3 concise and practical security suggestions.',
        'Warn the user if their personal information is included in the password. If so, emphasize changing it.',
        'Use a polite, user-facing tone.',
        'Respond in Turkish.',
        'Keep the entire reply short (3-6 sentences) and actionable.',
        'This report will be sent as a list of strings so make sure your sentences are clear and complete.'
    ].join('\n');
}

private buildUserMessage(stats: TextStats): string {
    // Include system prompt at the beginning of user message (v1beta compatibility)
    const systemPrompt = this.getSystemPrompt();
    const statistics = [
        'Statistics:',
        `- Uppercase letters: ${stats.upper}`,
        `- Lowercase letters: ${stats.lower}`,
        `- Digits: ${stats.digits}`,
        `- Special characters: ${stats.special}`,
        `- Whitespace characters: ${stats.whitespace}`,
        `- Total length: ${stats.totalLength}`,
        `${stats.includesNameOrSurname ? '- The password includes the user\'s name or surname.' : '' }`,
        `${stats.hasBirthYear ? '- The password includes the user\'s birth year.' : '' }`
    ].filter(line => line.trim()).join('\n');
    
    return `${systemPrompt}\n\n${statistics}`;
}
 
async callGenAi(text: string, personalInfo: any): Promise<AiReport> {
    // 1. Anahtar ve Model Ayarları
    const GEMINI_API_KEY= this.c.env.GEN_API_KEY;
    // Eğer env.GEN_MODEL ayarlanmışsa onu kullan, yoksa 'gemini-2.5-flash' modelini kullan
    const model = 'gemini-2.5-flash'; 

    // Metni işle
    const stats = this.processText(text, personalInfo);

    // API anahtarı yoksa yerel rapora dön
    if (!GEMINI_API_KEY) {
        const localReport = "API anahtarı bulunamadı. Yerel karakter analizi raporu: Metin uzunluğu: " + stats.totalLength;
        return { report: this.cleanAndSplit(localReport), source: 'local' };
    }

    // 2. Prompt Oluşturma
    

    // 3. API Uç Noktasını Oluşturma
    // Modeli ve API anahtarını doğrudan URL'ye ekliyoruz
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    try {
        // Gemini API expects system instructions and user content separately
        
        const userMessage = this.buildUserMessage(stats);

        const body = {
            contents: [{
                parts: [{ text: userMessage }]
            }],
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errorText = await res.text();
            //console.error('Gemini API Hata Yanıtı:', res.status, errorText);
            const fallback = `(Hata: Gemini API isteği başarısız oldu. Durum: ${res.status}. Detay: ${errorText.substring(0, 100)}...)`;
            return { report: this.cleanAndSplit(fallback), source: 'local' };
        }

        const data = await res.json();
        
        // 4. Yanıtı Ayrıştırma
        const generated = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generated) {
            // Yanıt gövdesi gelse bile içerik boş olabilir (örneğin güvenlik engeli)
            const fallback = `(Gemini'den yanıt alınamadı. Yanıt yapısı: ${JSON.stringify(data, null, 2).substring(0, 300)}...)`;
            return { report: this.cleanAndSplit(fallback), source: 'local' };
        }

        return { report: this.cleanAndSplit(generated), source: 'gemini' };
    } catch (err: any) {
        //console.error('Gemini API İstek Hatası:', err);
        const fallback = `(Genel Hata: Gemini API isteği sırasında bir hata oluştu: ${err?.message ?? String(err)})`;
        return { report: this.cleanAndSplit(fallback), source: 'local' };
    }
}


}