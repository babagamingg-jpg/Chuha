import { useState, useRef, useEffect, useCallback } from 'react';

let sharedAudioContext: AudioContext | null = null;

/**
 * Manages a single, shared AudioContext for the entire application
 * to prevent conflicts and resource exhaustion.
 * @returns The singleton AudioContext instance.
 */
export const getSharedAudioContext = (): AudioContext => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000 // Standardize on the 24kHz sample rate used by the narration API
    });
  }
  return sharedAudioContext;
};


// Helper function to decode base64 string to Uint8Array
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper function to decode raw PCM data into an AudioBuffer
export const getAudioBufferFromBase64 = async (
  base64: string,
  ctx: AudioContext,
): Promise<AudioBuffer> => {
  const data = decode(base64);
  // The API returns 24kHz, 1-channel, 16-bit PCM audio.
  const sampleRate = 24000;
  const numChannels = 1;
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};


export const useWebAudioPlayer = (
  base64AudioData: string | null,
  onEnded: () => void,
  shouldBePlaying: boolean
) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const onEndedCallbackRef = useRef(onEnded);

  useEffect(() => {
    onEndedCallbackRef.current = onEnded;
  }, [onEnded]);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null; // Prevent onEnded from firing on manual stop
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Main playback function
  const play = useCallback(async () => {
    try {
      const audioContext = getSharedAudioContext();
      if (!audioBufferRef.current || isLoading) return;
      
      if (audioContext.state === 'suspended') {
          await audioContext.resume();
      }
      
      // Stop any existing sound before playing a new one
      stop();
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        // Ensure this callback only runs for the currently active source
        if (source === sourceNodeRef.current) {
          sourceNodeRef.current = null;
          setIsPlaying(false);
          onEndedCallbackRef.current();
        }
      };
      
      source.start(0);
      sourceNodeRef.current = source;
      setIsPlaying(true);
    } catch (error) {
      console.error("Error during audio playback:", error);
      setIsPlaying(false);
    }
  }, [isLoading, stop]);

  // Effect to load new audio data.
  useEffect(() => {
    stop();
    audioBufferRef.current = null;
    let isCancelled = false;

    if (!base64AudioData) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const audioContext = getSharedAudioContext();

    getAudioBufferFromBase64(base64AudioData, audioContext)
      .then(buffer => {
        if (!isCancelled) {
          audioBufferRef.current = buffer;
        }
      })
      .catch(error => {
        console.error("Failed to decode audio data:", error);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });
    
    return () => {
      isCancelled = true;
    };
  }, [base64AudioData, stop]);

  // "Driver" effect to handle auto-play state changes.
  useEffect(() => {
    if (shouldBePlaying && !isPlaying && !isLoading && audioBufferRef.current) {
        play();
    } else if (!shouldBePlaying && isPlaying) {
        stop();
    }
  }, [shouldBePlaying, isPlaying, isLoading, play, stop]);

  return { isPlaying, isLoading, play };
};