import { useState, useEffect, useCallback, useRef } from 'react';

// Web Speech API interface definitions for TypeScript
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function useVoiceAssistant(locale: string = 'kn-IN') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasRecognitionSupport, setHasRecognitionSupport] = useState(false);
  const [hasSynthesisSupport, setHasSynthesisSupport] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindowWithSpeech) : null;
    if (!win) return;

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    setHasRecognitionSupport(!!SpeechRec);
    setHasSynthesisSupport('speechSynthesis' in win);
  }, []);

  const startListening = useCallback(
    (onResultCallback?: (text: string) => void) => {
      const win = typeof window !== 'undefined' ? (window as unknown as IWindowWithSpeech) : null;
      if (!win) return;
      const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!SpeechRec) return;

      try {
        if (recognitionRef.current) {
          recognitionRef.current.abort();
        }

        const rec = new SpeechRec();
        rec.lang = locale;
        rec.continuous = false;
        rec.interimResults = true;

        rec.onstart = () => {
          setIsListening(true);
          setTranscript('');
        };

        rec.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setTranscript(current);
          if (onResultCallback) {
            onResultCallback(current);
          }
        };

        rec.onerror = (e: any) => {
          console.warn('Speech recognition error:', e.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (err) {
        console.warn('Could not start speech recognition:', err);
        setIsListening(false);
      }
    },
    [locale],
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setIsListening(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();
      // Remove markdown chars and code blocks for clean pronunciation
      const clean = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*_~#>-]/g, '')
        .trim();

      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = locale;

      // Try selecting an appropriate voice
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = locale.split('-')[0];
      const matchingVoice =
        voices.find((v) => v.lang === locale) ||
        voices.find((v) => v.lang.startsWith(langPrefix)) ||
        voices.find((v) => v.lang.includes('IN'));

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [locale],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    isSpeaking,
    hasRecognitionSupport,
    hasSynthesisSupport,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
