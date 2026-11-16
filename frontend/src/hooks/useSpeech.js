import { useCallback, useEffect, useRef, useState } from 'react';

const Recognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const speechSupport = {
  speak: typeof window !== 'undefined' && 'speechSynthesis' in window,
  listen: Boolean(Recognition),
};

/**
 * Browser speech helpers.
 * speak(text)  -> Promise that resolves when the voice finishes (or immediately if unsupported)
 * listen(base, onText) -> starts recognition; onText receives base + everything heard so far
 * stopListening() -> ends recognition and stops auto-restart
 */
export function useSpeech() {
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const recRef = useRef(null);
  const wantRef = useRef(false);

  const speak = useCallback(
    (text) =>
      new Promise((resolve) => {
        if (!speechSupport.speak) return resolve();
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-IN';
        u.rate = 0.97;
        u.onend = resolve;
        u.onerror = resolve;
        window.speechSynthesis.speak(u);
      }),
    []
  );

  const stopSpeaking = useCallback(() => {
    if (speechSupport.speak) window.speechSynthesis.cancel();
  }, []);

  const stopListening = useCallback(() => {
    wantRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const listen = useCallback((base, onText) => {
    if (!Recognition) {
      setMicError('Speech recognition is not supported in this browser. Use Chrome or Edge, or type your answer.');
      return;
    }
    setMicError('');
    wantRef.current = true;
    let finalText = base ? base.trim() + ' ' : '';

    const rec = new Recognition();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk.trim() + ' ';
        else interim += chunk;
      }
      onText((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantRef.current = false;
        setMicError('Microphone access is blocked. Allow it in the browser address bar, or type your answer.');
      } else if (e.error === 'audio-capture') {
        wantRef.current = false;
        setMicError('No microphone was found. Plug one in, or type your answer.');
      }
    };
    // Chrome ends recognition after a pause even in continuous mode, so restart while still wanted.
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setMicError('Could not start the microphone. Try again.');
    }
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (speechSupport.speak) window.speechSynthesis.cancel();
    },
    []
  );

  return { speak, stopSpeaking, listen, stopListening, listening, micError };
}
