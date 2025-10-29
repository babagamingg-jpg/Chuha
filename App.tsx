import React, { useState, useCallback, useEffect } from 'react';
import { Slide, GenerationState, LessonState, GenerationProgress } from './types';
import Controls from './components/Controls';
import SlideViewer from './components/SlideViewer';
import * as geminiService from './services/geminiService';
import { getAudioBufferFromBase64, getSharedAudioContext } from './hooks/useWebAudioPlayer';

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [contextText, setContextText] = useState<string>('');
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [autoGenerateExplanation, setAutoGenerateExplanation] = useState<boolean>(true);
  
  const [lessonState, setLessonState] = useState<LessonState>('idle');
  
  const [isRegeneratingImage, setIsRegeneratingImage] = useState<number | null>(null);
  const [isRegeneratingTranslation, setIsRegeneratingTranslation] = useState<number | null>(null);
  const [isRegeneratingScript, setIsRegeneratingScript] = useState<number | null>(null);
  
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState(0);

  const isLessonGenerated = slides.length > 0;


  const generateSlides = useCallback(async () => {
    if (!inputText.trim()) return;

    setSlides([]);
    setLessonState('idle');
    setCurrentSlideIndex(0);
    
    setGenerationState('processing');
    setGenerationProgress({ current: 0, total: 1, step: "Analyzing lesson text" });

    let lines: string[];
    try {
        lines = await geminiService.splitTextIntoSentences(inputText);
        if (lines.length === 0) {
            throw new Error("No meaningful lines could be extracted from the text.");
        }
        setGenerationProgress({ current: 1, total: 1, step: "Analyzing lesson text" });
    } catch (e) {
        const error = e as Error;
        console.error("Failed to process text:", error.message);
        alert(`Error: ${error.message}`);
        setGenerationState('error');
        setGenerationProgress(null);
        return;
    }

    setGenerationState('translating');
    const newSlides: Slide[] = [];

    // Step 1: Translation & Explanation (with delay to prevent rate-limiting)
    const step1Name = autoGenerateExplanation ? "Translating & Explaining" : "Translating";
    setGenerationProgress({ current: 0, total: lines.length, step: step1Name });
    for (let i = 0; i < lines.length; i++) {
      const english = lines[i];
      const hindi = await geminiService.translateText(english, contextText);
      let script = " ";
      if (autoGenerateExplanation) {
          setGenerationState('explaining');
          script = await geminiService.generateExplanation(english, contextText);
      }
      newSlides.push({ id: i, english, hindi, imageUrl: null, script, audioData: null });
      setSlides([...newSlides]);
      setGenerationProgress({ current: i + 1, total: lines.length, step: step1Name });
      
      if (i < lines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Step 2: Image Generation (SEQUENTIAL to avoid rate limits)
    setGenerationState('imaging');
    setGenerationProgress({ current: 0, total: lines.length, step: 'Generating Images' });
    for (let i = 0; i < newSlides.length; i++) {
        try {
            const slide = newSlides[i];
            slide.imageUrl = await geminiService.generateImage(slide.english, slide.script, contextText);
            setSlides([...newSlides]);
            if (i < newSlides.length - 1) { // No delay after the last one
                await new Promise(resolve => setTimeout(resolve, 2000)); 
            }
        } catch (error) {
            console.error(`Failed to generate image for slide ${i}:`, error);
            newSlides[i].imageUrl = null; // Continue without an image
            setSlides([...newSlides]);
        } finally {
            setGenerationProgress({ current: i + 1, total: lines.length, step: 'Generating Images' });
        }
    }
    
    // Step 3: Narration Generation (SEQUENTIAL to avoid rate limits)
    setGenerationState('narrating');
    setGenerationProgress({ current: 0, total: newSlides.length, step: 'Generating Narration' });
    for (let i = 0; i < newSlides.length; i++) {
        try {
            const slide = newSlides[i];
            if (slide.script.trim()) {
                slide.audioData = await geminiService.generateSpeech(slide.script);
            } else {
                slide.audioData = null;
            }
            setSlides([...newSlides]);
            if (i < newSlides.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`Failed to generate audio for slide ${i}:`, error);
            newSlides[i].audioData = null; // Continue without audio
            setSlides([...newSlides]);
        } finally {
             setGenerationProgress({ current: i + 1, total: lines.length, step: 'Generating Narration' });
        }
    }

    setGenerationState('done');
    setGenerationProgress(null);

  }, [inputText, contextText, autoGenerateExplanation]);
  
  const handleNextSlide = useCallback(() => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      setLessonState('finished');
    }
  }, [currentSlideIndex, slides.length]);

  const handleNewLesson = useCallback(() => {
    setLessonState('idle');
    setInputText('');
    setContextText('');
    setSlides([]);
    setCurrentSlideIndex(0);
    setGenerationState('idle');
    setGenerationProgress(null);
  }, []);
  
  useEffect(() => {
    if (lessonState === 'playing') {
      // Auto-play logic handled by useWebAudioPlayer hook's onEnded callback
    }
  }, [lessonState, currentSlideIndex, handleNextSlide]);

  const startLesson = () => {
      if (slides.length > 0 && slides.every(s => s.audioData !== undefined)) {
          if (lessonState === 'finished') {
              setCurrentSlideIndex(0);
          }
          setLessonState('playing');
      }
  };
  
  const pauseLesson = () => setLessonState('paused');
  const handlePlayPause = () => {
    if (lessonState === 'playing') {
        pauseLesson();
    } else {
        startLesson();
    }
  };

  const handleManualNext = () => {
    if (currentSlideIndex < slides.length - 1) {
        setCurrentSlideIndex(prev => prev + 1);
        setLessonState('paused');
    }
  };

  const handleManualPrev = () => {
      if (currentSlideIndex > 0) {
          setCurrentSlideIndex(prev => prev - 1);
          setLessonState('paused');
      }
  };
  
  const handleRegenerateImage = useCallback(async () => {
    const slideIndex = currentSlideIndex;
    const slide = slides[slideIndex];
    if (!slide) return;

    setIsRegeneratingImage(slide.id);
    try {
      const newImageUrl = await geminiService.generateImage(slide.english, slide.script, contextText);
      setSlides(prevSlides => 
        prevSlides.map(s => s.id === slide.id ? { ...s, imageUrl: newImageUrl } : s)
      );
    } catch (error) {
      console.error("Failed to regenerate image:", error);
      alert("Sorry, the image could not be regenerated.");
    } finally {
      setIsRegeneratingImage(null);
    }
  }, [currentSlideIndex, slides, contextText]);
  
  const handleRegenerateTranslation = useCallback(async () => {
    const slideIndex = currentSlideIndex;
    const slide = slides[slideIndex];
    if (!slide) return;

    setIsRegeneratingTranslation(slide.id);
    try {
      const newHindi = await geminiService.translateText(slide.english, contextText);
      setSlides(prevSlides => 
        prevSlides.map(s => s.id === slide.id ? { ...s, hindi: newHindi } : s)
      );
    } catch (error) {
      console.error("Failed to regenerate translation:", error);
      alert("Sorry, the translation could not be regenerated.");
    } finally {
      setIsRegeneratingTranslation(null);
    }
  }, [currentSlideIndex, slides, contextText]);
  
  const handleRegenerateScript = useCallback(async () => {
    const slideIndex = currentSlideIndex;
    const slide = slides[slideIndex];
    if (!slide) return;

    setIsRegeneratingScript(slide.id);
    try {
      const newScript = await geminiService.generateExplanation(slide.english, contextText);
      const newAudioData = await geminiService.generateSpeech(newScript);
      setSlides(prevSlides => 
        prevSlides.map(s => s.id === slide.id ? { ...s, script: newScript, audioData: newAudioData } : s)
      );
    } catch (error) {
      console.error("Failed to regenerate script:", error);
      alert("Sorry, the explanation and narration could not be regenerated.");
    } finally {
      setIsRegeneratingScript(null);
    }
  }, [currentSlideIndex, slides, contextText]);

  const handleDownloadVideo = useCallback(async () => {
    if (slides.length === 0 || isGeneratingVideo) return;
  
    setIsGeneratingVideo(true);
    setVideoGenerationProgress(0);

    const mimeType = 'video/webm; codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        alert('Video recording in the required format (WebM VP9/Opus) is not supported by your browser. Please try the latest version of Chrome or Firefox.');
        setIsGeneratingVideo(false);
        return;
    }
  
    const audioContext = getSharedAudioContext();
  
    try {
        await document.fonts.ready;
  
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error("Could not get canvas context");
        
        const audioDestination = audioContext.createMediaStreamDestination();
        const videoStream = canvas.captureStream(30);
        const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
        ]);
        
        const recorder = new MediaRecorder(combinedStream, { 
            mimeType: mimeType,
            videoBitsPerSecond: 12000000,
            audioBitsPerSecond: 128000,
        });
        const recordedChunks: Blob[] = [];
  
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) recordedChunks.push(event.data);
        };
  
        const recordingPromise = new Promise<void>((resolve) => {
            recorder.onstop = () => {
              const blob = new Blob(recordedChunks, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'english-rajdhani-lesson.webm';
              document.body.appendChild(a); a.click();
              window.URL.revokeObjectURL(url); document.body.removeChild(a);
              resolve();
            };
        });

        const drawDynamicBackground = (targetCtx: CanvasRenderingContext2D) => {
            const { width, height } = targetCtx.canvas;
        
            // Replicate the "Deep Cosmos" theme from the app's CSS for a consistent look.
            const gradient = targetCtx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, 'rgba(11, 17, 32, 1)');
            gradient.addColorStop(0.25, 'rgba(13, 27, 62, 1)');
            gradient.addColorStop(0.5, 'rgba(8, 16, 35, 1)');
            gradient.addColorStop(0.75, 'rgba(13, 27, 62, 1)');
            gradient.addColorStop(1, 'rgba(11, 17, 32, 1)');
            
            targetCtx.fillStyle = gradient;
            targetCtx.fillRect(0, 0, width, height);
    
            // Draw the subtle blueprint grid pattern
            targetCtx.save();
            targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            targetCtx.lineWidth = 1;
            const gridSize = 50;
    
            for (let x = 0; x < width; x += gridSize) {
                targetCtx.beginPath();
                targetCtx.moveTo(x, 0);
                targetCtx.lineTo(x, height);
                targetCtx.stroke();
            }
            for (let y = 0; y < height; y += gridSize) {
                targetCtx.beginPath();
                targetCtx.moveTo(0, y);
                targetCtx.lineTo(width, y);
                targetCtx.stroke();
            }
            targetCtx.restore();
        };
        
        const loadImage = (src: string | null): Promise<HTMLImageElement | null> => new Promise(resolve => {
            if (!src) return resolve(null);
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = `data:image/png;base64,${src}`;
        });

        const calculateLines = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
            if (!text) return [];
            const words = text.split(' ');
            let lines: string[] = []; let currentLine = words[0] || '';
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + ' ' + words[i];
                if (context.measureText(testLine).width > maxWidth) {
                    lines.push(currentLine); currentLine = words[i];
                } else { currentLine = testLine; }
            }
            lines.push(currentLine); return lines;
        };

        const createTextCache = (slide: Slide): HTMLCanvasElement => {
            const textCacheCanvas = document.createElement('canvas');
            textCacheCanvas.width = canvas.width; textCacheCanvas.height = canvas.height;
            const textCtx = textCacheCanvas.getContext('2d')!;
            const MAX_TEXT_WIDTH = canvas.width / 2 - 80; const MAX_TEXT_HEIGHT = canvas.height - 80;
            let finalEnglishFontSize = 0, finalHindiFontSize = 0, totalTextHeight = 0; let englishLines: string[] = [], hindiLines: string[] = [];
            for (let size = 48; size >= 10; size -= 2) {
                const currentEnglishFontSize = size; const currentHindiFontSize = Math.floor(size * 0.85);
                const englishLineHeight = currentEnglishFontSize * 1.3; const hindiLineHeight = currentHindiFontSize * 1.5;
                textCtx.font = `700 ${currentEnglishFontSize}px Poppins`; const tempEnglishLines = calculateLines(textCtx, slide.english, MAX_TEXT_WIDTH);
                textCtx.font = `700 ${currentHindiFontSize}px "Tiro Devanagari Hindi"`; const tempHindiLines = calculateLines(textCtx, slide.hindi, MAX_TEXT_WIDTH);
                const calculatedHeight = (tempEnglishLines.length * englishLineHeight) + (tempHindiLines.length * hindiLineHeight) + (tempHindiLines.length > 0 ? 25 : 0);
                if (calculatedHeight <= MAX_TEXT_HEIGHT) {
                    finalEnglishFontSize = currentEnglishFontSize; finalHindiFontSize = currentHindiFontSize; englishLines = tempEnglishLines; hindiLines = tempHindiLines; totalTextHeight = calculatedHeight; break;
                }
            }
            const startY = (canvas.height - totalTextHeight) / 2; let currentY = startY;
            textCtx.shadowColor = 'rgba(0, 0, 0, 0.7)'; textCtx.shadowBlur = 8; textCtx.fillStyle = '#EAEAEA'; textCtx.font = `700 ${finalEnglishFontSize}px Poppins`; textCtx.textAlign = 'center'; textCtx.textBaseline = 'top';
            const englishLineHeight = finalEnglishFontSize * 1.3;
            for (const line of englishLines) { textCtx.fillText(line, canvas.width / 4, currentY); currentY += englishLineHeight; }
            if (hindiLines.length > 0) {
                currentY += 25; textCtx.shadowColor = 'rgba(0, 0, 0, 0.5)'; textCtx.shadowBlur = 10; textCtx.fillStyle = '#F9D423'; textCtx.font = `700 ${finalHindiFontSize}px "Tiro Devanagari Hindi"`;
                const hindiLineHeight = finalHindiFontSize * 1.5;
                for (const line of hindiLines) { textCtx.fillText(line, canvas.width / 4, currentY); currentY += hindiLineHeight; }
            }
            return textCacheCanvas;
        };

        const drawSlideContent = (
            targetCtx: CanvasRenderingContext2D,
            textCache: HTMLCanvasElement,
            img: HTMLImageElement | null, 
            now: number, 
            slideProgress: number,
            isFirstSlide: boolean,
            isLastSlide: boolean,
            elapsedSinceSlideStart: number,
            slideDuration: number
        ) => {
              const { width: canvasWidth, height: canvasHeight } = targetCtx.canvas;
              // Easing for animations
              const easedSlideProgress = 0.5 - 0.5 * Math.cos(slideProgress * Math.PI);

              targetCtx.save();
              const imagePanelX = canvasWidth / 2;
              const imagePanelWidth = canvasWidth / 2;
              if (img) {
                  // Smoother Ken Burns effect with easing
                  const zoom = 1 + easedSlideProgress * 0.05;
                  const panX = (easedSlideProgress - 0.5) * -20;
                  const panY = (easedSlideProgress - 0.5) * -10;
                  const hRatio = imagePanelWidth / img.width; const vRatio = canvasHeight / img.height;
                  const baseRatio = Math.min(hRatio, vRatio) * 0.9;
                  const imgWidth = img.width * baseRatio * zoom; const imgHeight = img.height * baseRatio * zoom;
                  const centerShift_x = (imagePanelWidth - imgWidth) / 2; const centerShift_y = (canvasHeight - imgHeight) / 2;
                  targetCtx.shadowColor = 'rgba(0, 0, 0, 0.5)'; targetCtx.shadowBlur = 20;
                  targetCtx.drawImage(img, imagePanelX + centerShift_x + panX, centerShift_y + panY, imgWidth, imgHeight);
              } else {
                  targetCtx.fillStyle = 'rgba(255, 255, 255, 0.4)'; targetCtx.font = '30px Poppins';
                  targetCtx.textAlign = 'center'; targetCtx.textBaseline = 'middle';
                  targetCtx.fillText('Image not available', canvasWidth * 0.75, canvasHeight / 2);
              }
              targetCtx.restore();
  
              const pulse = Math.sin(now / 400) * 5;
              targetCtx.save();
              targetCtx.shadowColor = '#00E5FF'; targetCtx.shadowBlur = 15 + pulse;
              targetCtx.strokeStyle = `rgba(0, 229, 255, ${0.8 + pulse * 0.04})`;
              targetCtx.lineWidth = 2; targetCtx.beginPath(); targetCtx.moveTo(canvasWidth / 2, 40);
              targetCtx.lineTo(canvasWidth / 2, canvasHeight - 40); targetCtx.stroke();
              targetCtx.restore();
  
              targetCtx.save();
              // Enhanced text animation: slide up and fade in
              const textFadeInDuration = 0.75;
              const textAnimationProgress = Math.min(1, elapsedSinceSlideStart / textFadeInDuration);
              const easedTextProgress = 1 - Math.pow(1 - textAnimationProgress, 3); // easeOutCubic
              targetCtx.globalAlpha = easedTextProgress;
              const textYOffset = (1 - easedTextProgress) * 30;
              targetCtx.drawImage(textCache, 0, textYOffset);
              targetCtx.restore();

              targetCtx.save();
              const watermarkFadeDuration = 1.5;
              let watermarkAlpha = 1;
              if (isFirstSlide && elapsedSinceSlideStart < watermarkFadeDuration) {
                  watermarkAlpha = elapsedSinceSlideStart / watermarkFadeDuration;
              } else if (isLastSlide && elapsedSinceSlideStart > (slideDuration - watermarkFadeDuration)) {
                  const fadeOutTime = elapsedSinceSlideStart - (slideDuration - watermarkFadeDuration);
                  watermarkAlpha = 1 - (fadeOutTime / watermarkFadeDuration);
              }
              watermarkAlpha = Math.max(0, Math.min(1, watermarkAlpha)); // Clamp alpha
              targetCtx.globalAlpha = watermarkAlpha;
              targetCtx.fillStyle = `rgba(234, 234, 234, 0.7)`;
              targetCtx.font = '20px Poppins'; targetCtx.textBaseline = 'bottom';
              targetCtx.textAlign = 'right';
              targetCtx.fillText('English Rajdhani', canvasWidth - 40, canvasHeight - 30);
              targetCtx.restore();
        };

        // 1. TIMELINE & ASSET PREPARATION
        const slideDurations = await Promise.all(slides.map(async (slide) => {
            if (!slide.audioData) return 3.0; // Default duration
            const buffer = await getAudioBufferFromBase64(slide.audioData, audioContext);
            return buffer.duration > 0.5 ? buffer.duration + 0.5 : 3.0; // Add padding for visuals
        }));
        
        const transitionDuration = 0;
        const timeline: any[] = [];
        let currentTime = 0;
        for (let i = 0; i < slides.length; i++) {
            timeline.push({ type: 'slide', index: i, startTime: currentTime, duration: slideDurations[i] });
            currentTime += slideDurations[i];
            if (i < slides.length - 1) {
                timeline.push({ type: 'transition', from: i, to: i + 1, startTime: currentTime, duration: transitionDuration });
                currentTime += transitionDuration;
            }
        }
        const totalDuration = currentTime;
        
        const preloadedImages = await Promise.all(slides.map(s => loadImage(s.imageUrl)));
        const preloadedTextCaches = slides.map(s => createTextCache(s));
        
        // 2. SCHEDULE AUDIO
        const audioStartOffset = audioContext.currentTime;
        timeline.filter(e => e.type === 'slide').forEach(async (slideEvent) => {
            const slide = slides[slideEvent.index];
            if (slide.audioData) {
                const audioBuffer = await getAudioBufferFromBase64(slide.audioData, audioContext);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioDestination);
                source.start(audioStartOffset + slideEvent.startTime);
            }
        });

        // 3. RENDER VIDEO
        recorder.start();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        await new Promise<void>(resolve => {
            const renderLoop = (now: number) => {
                const elapsed = audioContext.currentTime - audioStartOffset;
                setVideoGenerationProgress(Math.min(1, elapsed / totalDuration));

                const currentEvent = timeline.find(e => elapsed >= e.startTime && elapsed < e.startTime + e.duration);
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawDynamicBackground(ctx);

                if (currentEvent) {
                    const eventProgress = (elapsed - currentEvent.startTime) / currentEvent.duration;
                    if (currentEvent.type === 'slide') {
                        const i = currentEvent.index;
                        drawSlideContent(ctx, preloadedTextCaches[i], preloadedImages[i], now, eventProgress, i === 0, i === slides.length - 1, elapsed - currentEvent.startTime, currentEvent.duration);
                    } else if (currentEvent.type === 'transition') {
                        const easedProgress = 0.5 - 0.5 * Math.cos(eventProgress * Math.PI); // Ease-in-out
                        
                        // Draw outgoing slide content, moving left
                        ctx.save();
                        ctx.translate(-easedProgress * canvas.width, 0);
                        drawSlideContent(ctx, preloadedTextCaches[currentEvent.from], preloadedImages[currentEvent.from], now, 1, false, false, slideDurations[currentEvent.from], slideDurations[currentEvent.from]);
                        ctx.restore();

                        // Draw incoming slide content, moving in from right
                        ctx.save();
                        ctx.translate((1 - easedProgress) * canvas.width, 0);
                        drawSlideContent(ctx, preloadedTextCaches[currentEvent.to], preloadedImages[currentEvent.to], now, 0, false, false, 0, slideDurations[currentEvent.to]);
                        ctx.restore();
                    }
                } else if (elapsed >= totalDuration) {
                    // Render the very last frame
                    const i = slides.length - 1;
                    drawSlideContent(ctx, preloadedTextCaches[i], preloadedImages[i], now, 1, false, true, slideDurations[i], slideDurations[i]);
                }

                if (elapsed < totalDuration) {
                    requestAnimationFrame(renderLoop);
                } else {
                    // Hold the last frame for a moment before stopping
                    setTimeout(resolve, 100);
                }
            };
            requestAnimationFrame(renderLoop);
        });

        recorder.stop();
        await recordingPromise;
  
    } catch (error) {
        console.error("Error generating video:", error);
        alert("An error occurred while creating the video. Please check the console for details.");
    } finally {
        // DO NOT CLOSE the shared audio context.
        setIsGeneratingVideo(false);
        setVideoGenerationProgress(0);
    }
  }, [slides, isGeneratingVideo]);


  return (
    <main className="h-screen w-screen bg-transparent p-6 gap-6 flex flex-col md:flex-row">
      <div className="w-full md:w-2/3 h-full">
        <SlideViewer
          slide={slides[currentSlideIndex] ?? null}
          totalSlides={slides.length}
          currentSlideIndex={currentSlideIndex}
          lessonState={lessonState}
          onCompletion={handleNextSlide}
          onPlayPause={handlePlayPause}
          onNext={handleManualNext}
          onPrev={handleManualPrev}
          onRegenerateImage={handleRegenerateImage}
          isRegeneratingImage={isRegeneratingImage === slides[currentSlideIndex]?.id}
          onRegenerateTranslation={handleRegenerateTranslation}
          isRegeneratingTranslation={isRegeneratingTranslation === slides[currentSlideIndex]?.id}
          onRegenerateScript={handleRegenerateScript}
          isRegeneratingScript={isRegeneratingScript === slides[currentSlideIndex]?.id}
          isGeneratingVideo={isGeneratingVideo}
        />
      </div>
      <div className="w-full md:w-1/3 h-full">
        <Controls
          inputText={inputText}
          setInputText={setInputText}
          contextText={contextText}
          setContextText={setContextText}
          slides={slides}
          generateSlides={generateSlides}
          generationState={generationState}
          generationProgress={generationProgress}
          lessonState={lessonState}
          startLesson={startLesson}
          pauseLesson={pauseLesson}
          autoGenerateExplanation={autoGenerateExplanation}
          setAutoGenerateExplanation={setAutoGenerateExplanation}
          onDownloadVideo={handleDownloadVideo}
          isGeneratingVideo={isGeneratingVideo}
          videoGenerationProgress={videoGenerationProgress}
          onNewLesson={handleNewLesson}
        />
      </div>
    </main>
  );
};

export default App;