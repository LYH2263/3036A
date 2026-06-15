export interface SpeechVoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  isDefault: boolean;
}

export interface SpeakWordOptions {
  lang?: string;
  voiceURI?: string;
  rate?: number;
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const synth = window.speechSynthesis as SpeechSynthesis | undefined;
  return Boolean(synth && typeof synth.speak === 'function' && typeof synth.cancel === 'function');
}

export function listSpeechVoices(): SpeechVoiceOption[] {
  if (!isSpeechSynthesisSupported()) {
    return [];
  }

  const synth = window.speechSynthesis as SpeechSynthesis & {
    getVoices?: () => SpeechSynthesisVoice[];
  };

  if (typeof synth.getVoices !== 'function') {
    return [];
  }

  return synth
    .getVoices()
    .map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI,
      isDefault: voice.default
    }))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      return a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
    });
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  options: SpeakWordOptions
): SpeechSynthesisVoice | null {
  if (options.voiceURI) {
    const byUri = voices.find((item) => item.voiceURI === options.voiceURI);
    if (byUri) {
      return byUri;
    }
  }

  if (!options.lang) {
    return null;
  }

  const targetLang = options.lang.toLowerCase();
  const byExactLang = voices.find((item) => item.lang.toLowerCase() === targetLang);
  if (byExactLang) {
    return byExactLang;
  }

  const langPrefix = targetLang.split('-')[0];
  return (
    voices.find((item) => item.lang.toLowerCase().startsWith(`${langPrefix}-`)) ??
    voices.find((item) => item.lang.toLowerCase() === langPrefix) ??
    null
  );
}

export function speakWord(text: string, options: SpeakWordOptions = {}): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const synth = window.speechSynthesis;
  if (!synth || typeof synth.speak !== 'function' || typeof synth.cancel !== 'function') {
    return false;
  }

  const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
  const selectedVoice = pickVoice(voices, options);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = selectedVoice?.lang || options.lang || 'en-US';
  utterance.rate = options.rate ?? 0.95;
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  synth.cancel();
  synth.speak(utterance);
  return true;
}
