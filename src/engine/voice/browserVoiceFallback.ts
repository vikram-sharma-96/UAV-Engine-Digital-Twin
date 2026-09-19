/**
 * browserVoiceFallback.ts
 * 
 * Client-Side Voice Manager & Web Speech API Fallback.
 * 
 * Provides:
 * - Client-side speech recognition (Web Speech API)
 * - Browser SpeechSynthesis fallback when ElevenLabs is offline
 * - Audio playback queue, interruption / barge-in, and mute control
 */

import { DEFAULT_VOICE_CONFIG, type VoiceConfig, type VoiceState, type VoiceInputProvider } from './types.ts';

export class BrowserVoiceManager implements VoiceInputProvider {
  name = 'Browser-WebSpeech-Manager';
  private recognition: any = null;
  private isListeningActive = false;
  private currentAudioElement: HTMLAudioElement | null = null;
  private isMuted = false;
  private onStateChangeCallback?: (state: VoiceState) => void;

  constructor(onStateChange?: (state: VoiceState) => void) {
    this.onStateChangeCallback = onStateChange;
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      } catch (e) {
        console.warn('[Voice Manager]: SpeechRecognition init warning:', e);
      }
    }
  }

  isAvailable(): boolean {
    return Boolean(this.recognition);
  }

  startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (err: string) => void
  ): void {
    if (!this.recognition) {
      onError('SPEECH_RECOGNITION_NOT_SUPPORTED: Browser lacks SpeechRecognition support.');
      return;
    }

    // Stop any ongoing speech playback (Barge-in / Interruption Rule)
    this.stopSpeaking();

    this.isListeningActive = true;
    this.onStateChangeCallback?.('LISTENING');

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        onTranscript(final.trim(), true);
      } else if (interim) {
        onTranscript(interim.trim(), false);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListeningActive = false;
      this.onStateChangeCallback?.('ERROR');
      onError(event.error || 'Speech recognition error');
    };

    this.recognition.onend = () => {
      this.isListeningActive = false;
      this.onStateChangeCallback?.('IDLE');
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      this.isListeningActive = false;
      this.onStateChangeCallback?.('ERROR');
      onError(e.message || 'Failed to start microphone');
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListeningActive) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListeningActive = false;
    this.onStateChangeCallback?.('IDLE');
  }

  /**
   * Play streaming or static audio from ElevenLabs server endpoint.
   * If streaming is unsupported or ElevenLabs fails, smoothly falls back to browser SpeechSynthesis.
   */
  async playServerVoice(audioUrl: string, fallbackText: string): Promise<void> {
    if (this.isMuted) return;

    this.stopSpeaking(); // Interrupt previous audio

    this.onStateChangeCallback?.('SPEAKING');

    try {
      const audio = new Audio(audioUrl);
      this.currentAudioElement = audio;

      audio.onended = () => {
        this.currentAudioElement = null;
        this.onStateChangeCallback?.('IDLE');
      };

      audio.onerror = () => {
        // Fallback to browser SpeechSynthesis
        this.currentAudioElement = null;
        this.speakBrowserFallback(fallbackText);
      };

      await audio.play();
    } catch {
      this.speakBrowserFallback(fallbackText);
    }
  }

  /**
   * Browser SpeechSynthesis fallback (100% offline).
   */
  speakBrowserFallback(text: string): void {
    if (this.isMuted || typeof window === 'undefined' || !window.speechSynthesis) {
      this.onStateChangeCallback?.('IDLE');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    utterance.onstart = () => {
      this.onStateChangeCallback?.('SPEAKING');
    };

    utterance.onend = () => {
      this.onStateChangeCallback?.('IDLE');
    };

    utterance.onerror = () => {
      this.onStateChangeCallback?.('IDLE');
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Interrupt and immediately stop any audio playing (Barge-In).
   */
  stopSpeaking(): void {
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.src = '';
      this.currentAudioElement = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.onStateChangeCallback?.('IDLE');
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopSpeaking();
    }
  }

  isSpeaking(): boolean {
    return Boolean(
      this.currentAudioElement || 
      (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking)
    );
  }
}
