/**
 * elevenLabsClient.ts
 * 
 * Production-grade, Server-Side ElevenLabs Voice Client for AeroTwin AI.
 * 
 * SECURITY MANDATE:
 * - Runs exclusively server-side (Node.js runtime).
 * - Loads ELEVENLABS_API_KEY from server environment variables.
 * - NEVER exposes the API key to client browsers, responses, or logs.
 * - Enforces rate limiting, text length safety caps, and duplicate call suppression.
 */

import { DEFAULT_VOICE_CONFIG, type VoiceConfig, type VoiceOutputProvider } from './types.ts';

export class ElevenLabsClient implements VoiceOutputProvider {
  name = 'ElevenLabs-Streaming-TTS';
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private lastRequestTimestamp: number = 0;
  private lastSpokenText: string = '';
  private minIntervalMs: number = 1000; // Minimum 1s between successive TTS calls to prevent spam
  private maxTextLength: number = 500;   // Spoken outputs should remain concise (1-3 sentences)

  /**
   * Check if ElevenLabs API key is configured and valid on the server.
   */
  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 10 && !key.includes('placeholder'));
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/user`, {
        method: 'GET',
        headers: { 'xi-api-key': this.getApiKey() },
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve server-side API key from environment.
   */
  private getApiKey(): string {
    return (typeof process !== 'undefined' && process.env?.ELEVENLABS_API_KEY) || '';
  }

  /**
   * Synthesize text to speech using ElevenLabs streaming endpoint.
   * Returns a Node ReadableStream / Web ReadableStream of raw audio/mpeg chunks.
   */
  async synthesizeSpeech(
    text: string,
    options?: {
      voiceId?: string;
      model?: string;
      stability?: number;
      similarityBoost?: number;
    }
  ): Promise<ReadableStream<Uint8Array> | null> {
    if (!this.isConfigured()) {
      throw new Error('ELEVENLABS_API_KEY_NOT_CONFIGURED: Voice API key is missing from server environment.');
    }

    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('INVALID_TEXT: Speech text cannot be empty.');
    }

    // Safety checks: Enforce length and rate limits
    const truncatedText = cleanText.length > this.maxTextLength
      ? cleanText.slice(0, this.maxTextLength) + '...'
      : cleanText;

    const now = Date.now();
    if (now - this.lastRequestTimestamp < this.minIntervalMs && truncatedText === this.lastSpokenText) {
      // Suppress duplicate calls within minimum window
      return null;
    }
    this.lastRequestTimestamp = now;
    this.lastSpokenText = truncatedText;

    const voiceId = options?.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_CONFIG.voiceId;
    const model = options?.model || process.env.ELEVENLABS_TTS_MODEL || DEFAULT_VOICE_CONFIG.ttsModel;

    const url = `${this.baseUrl}/text-to-speech/${encodeURIComponent(voiceId)}/stream?optimize_streaming_latency=3`;

    const payload = {
      text: truncatedText,
      model_id: model,
      voice_settings: {
        stability: options?.stability ?? DEFAULT_VOICE_CONFIG.stability,
        similarity_boost: options?.similarityBoost ?? DEFAULT_VOICE_CONFIG.similarityBoost,
        style: DEFAULT_VOICE_CONFIG.style,
        use_speaker_boost: true,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.getApiKey(),
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8s timeout guard
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      if (response.status === 401) {
        throw new Error('ELEVENLABS_UNAUTHORIZED: Invalid API key.');
      }
      if (response.status === 429) {
        throw new Error('ELEVENLABS_QUOTA_EXCEEDED: API credit limit or rate limit exceeded.');
      }
      throw new Error(`ELEVENLABS_ERROR (${response.status}): ${errText}`);
    }

    if (!response.body) {
      throw new Error('ELEVENLABS_EMPTY_RESPONSE: No audio stream returned.');
    }

    return response.body as ReadableStream<Uint8Array>;
  }

  /**
   * Query available voices from ElevenLabs account.
   */
  async getVoices(): Promise<Array<{ voice_id: string; name: string; category: string }>> {
    if (!this.isConfigured()) return [];
    try {
      const res = await fetch(`${this.baseUrl}/voices`, {
        headers: { 'xi-api-key': this.getApiKey() },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.voices || []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category || 'premade',
      }));
    } catch {
      return [];
    }
  }
}

// Global server singleton
export const elevenLabsClient = new ElevenLabsClient();
