import React, { useEffect, useCallback, useState, useRef, useLayoutEffect } from 'react';
import { Slide, LessonState } from '../types';
import { PrevIcon, NextIcon, PlayIcon, PauseIcon, ReplayIcon, EnterFullscreenIcon, ExitFullscreenIcon, RefreshIcon, TranslateIcon, ScriptIcon } from './Icons';
import { useWebAudioPlayer } from '../hooks/useWebAudioPlayer';

interface SlideViewerProps {
  slide: Slide | null;
  totalSlides: number;
  currentSlideIndex: number;
  lessonState: LessonState;
  onCompletion: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRegenerateImage: () => void;
  isRegeneratingImage: boolean;
  onRegenerateTranslation: () => void;
  isRegeneratingTranslation: boolean;
  onRegenerateScript: () => void;
  isRegeneratingScript: boolean;
  isGeneratingVideo: boolean;
}

const SlideViewer: React.FC<SlideViewerProps> = ({
  slide,
  totalSlides,
  currentSlideIndex,
  lessonState,
  onCompletion,
  onPlayPause,
  onNext,
  onPrev,
  onRegenerateImage,
  isRegeneratingImage,
  onRegenerateTranslation,
  isRegeneratingTranslation,
  onRegenerateScript,
  isRegeneratingScript,
  isGeneratingVideo,
}) => {
  const { isLoading, play } = useWebAudioPlayer(
    slide?.audioData || null,
    onCompletion,
    lessonState === 'playing'
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(true);
  const fullscreenTextRef = useRef<HTMLDivElement>(null);
  
  const anyRegenerationInProgress = isRegeneratingImage || isRegeneratingTranslation || isRegeneratingScript;
  const isRegenerating = isGeneratingVideo || anyRegenerationInProgress;
  const isPlaybackDisabled = isGeneratingVideo || isLoading;


  useLayoutEffect(() => {
    if (!isFullscreen || !fullscreenTextRef.current) {
      return;
    }

    const element = fullscreenTextRef.current;
    let animationFrameId: number;

    const adjustFontScale = () => {
      // Read the current scale directly from the element's style.
      const currentScale = parseFloat(element.style.getPropertyValue('--font-scale-factor') || '1');

      // Measure if the element is overflowing vertically.
      const isOverflowing = element.scrollHeight > element.clientHeight;
      
      if (isOverflowing) {
        // Define shrinking parameters.
        const newScale = currentScale - 0.02; // A small step for finer control.
        const minScale = 0.5; // Do not shrink smaller than 50%.

        if (newScale >= minScale) {
          // If we can still shrink, apply the new scale...
          element.style.setProperty('--font-scale-factor', `${newScale}`);
          // ...and schedule another check on the next animation frame.
          animationFrameId = requestAnimationFrame(adjustFontScale);
        }
      }
    };

    // Reset scale to 1 before starting adjustments to measure the natural size.
    element.style.setProperty('--font-scale-factor', '1');
    
    // Start the adjustment process on the next frame. This allows the browser to apply
    // the reset scale and compute the correct initial scrollHeight.
    animationFrameId = requestAnimationFrame(adjustFontScale);

    // Return a cleanup function to cancel the animation frame if dependencies change
    // or the component unmounts before the adjustment is finished.
    return () => {
      cancelAnimationFrame(animationFrameId);
    };

  }, [isFullscreen, slide]); // Rerun when slide or fullscreen state changes

  const handleReplay = useCallback(() => {
    play();
  }, [play]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  }, []);

  const handleFullscreenPlayPause = () => {
    // If we're about to play, hide controls.
    if (lessonState !== 'playing') {
      setShowFullscreenControls(false);
    }
    onPlayPause(); // Toggle state
  };

  useEffect(() => {
    const onFullscreenChange = () => {
        const isFs = !!document.fullscreenElement;
        setIsFullscreen(isFs);
        if (isFs) {
            setShowFullscreenControls(true); // Always show controls when first entering fullscreen
        }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange); // Safari
    document.addEventListener('mozfullscreenchange', onFullscreenChange); // Firefox
    document.addEventListener('MSFullscreenChange', onFullscreenChange); // IE/Edge

    return () => {
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
        document.removeEventListener('mozfullscreenchange', onFullscreenChange);
        document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
}, []);


  if (!slide) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/20 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10">
        <p className="text-gray-400 text-lg">Create a lesson to begin</p>
      </div>
    );
  }

  const renderSpinner = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <div className="w-full h-full relative">
        {/* Standard Slide Viewer UI */}
        <div className="w-full h-full flex flex-col bg-black/20 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/10">
            {/* Main Content Area */}
            <div className="flex-grow flex flex-col md:flex-row min-h-0 relative">
                {/* Text Content */}
                <div className="relative group w-full md:w-1/2 flex flex-col justify-center p-6 md:p-8 overflow-y-auto">
                    <p className="text-3xl md:text-4xl font-bold text-[#EAEAEA]" style={{ textShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>{slide.english}</p>
                    <p className="font-hindi text-2xl md:text-3xl mt-4 text-[#F9D423] font-semibold" style={{ textShadow: '0 0 10px rgba(249, 212, 35, 0.6)' }}>{slide.hindi}</p>
                    
                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col gap-2">
                        <button 
                            onClick={onRegenerateTranslation} 
                            disabled={isRegenerating}
                            className="p-2 w-9 h-9 flex items-center justify-center rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-75 disabled:cursor-not-allowed disabled:bg-opacity-30"
                            title="Regenerate Hindi Translation"
                        >
                            {isRegeneratingTranslation ? renderSpinner() : <TranslateIcon className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={onRegenerateScript} 
                            disabled={isRegenerating}
                            className="p-2 w-9 h-9 flex items-center justify-center rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-75 disabled:cursor-not-allowed disabled:bg-opacity-30"
                            title="Regenerate Hindi Explanation & Narration"
                        >
                            {isRegeneratingScript ? renderSpinner() : <ScriptIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Glowing Divider */}
                <div className="hidden md:block absolute left-1/2 top-10 bottom-10 w-0.5 bg-cyan-400/50" style={{ boxShadow: '0 0 15px 2px #00E5FF' }}></div>
                
                {/* Image Content */}
                <div className="relative group w-full md:w-1/2 h-64 md:h-auto bg-transparent flex items-center justify-center p-4">
                    {slide.imageUrl ? (
                        <img src={`data:image/png;base64,${slide.imageUrl}`} alt={slide.english} className="max-w-full max-h-full object-contain" style={{filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.4))'}}/>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <svg className="animate-spin h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="ml-3 text-gray-400">Working on the image...</p>
                        </div>
                    )}
                     <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button 
                            onClick={onRegenerateImage} 
                            disabled={isRegenerating}
                            className="p-2 w-9 h-9 flex items-center justify-center rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-75 disabled:cursor-not-allowed disabled:bg-opacity-30"
                            title="Regenerate Image"
                        >
                            {isRegeneratingImage ? renderSpinner() : <RefreshIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex-shrink-0 flex items-center justify-between bg-black/40 backdrop-blur-md p-3 border-t border-white/10">
                {/* Left side: Placeholder for alignment */}
                <div className="w-1/3 flex justify-start">
                </div>

                {/* Center: Playback Controls */}
                <div className="w-1/3 flex justify-center items-center gap-2 md:gap-3">
                    <button onClick={onPrev} disabled={currentSlideIndex === 0 || isPlaybackDisabled} className="p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:bg-white/10 transition-all"><PrevIcon className="w-6 h-6"/></button>
                        
                    <button onClick={onPlayPause} disabled={isPlaybackDisabled || !slide.audioData} className="w-12 h-12 flex items-center justify-center rounded-full bg-teal-500 text-black hover:bg-teal-400 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-400 disabled:bg-teal-800 disabled:text-gray-500 disabled:cursor-not-allowed">
                        {isLoading ? (
                            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : lessonState === 'playing' ? (
                            <PauseIcon className="w-6 h-6" />
                        ) : (
                            <PlayIcon className="w-6 h-6" />
                        )}
                    </button>

                    <button onClick={handleReplay} disabled={!slide.audioData || isPlaybackDisabled} className="p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:bg-white/10 transition-all">
                        <ReplayIcon className="w-6 h-6" />
                    </button>

                    <button onClick={onNext} disabled={currentSlideIndex === totalSlides - 1 || isPlaybackDisabled} className="p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:bg-white/10 transition-all"><NextIcon className="w-6 h-6"/></button>
                </div>
                
                {/* Right side: Fullscreen Button */}
                <div className="w-1/3 flex justify-end">
                    <button onClick={handleFullscreen} className="p-2 rounded-full text-gray-300 hover:bg-white/10 transition-all" title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
                        {isFullscreen ? <ExitFullscreenIcon className="w-6 h-6" /> : <EnterFullscreenIcon className="w-6 h-6" />}
                    </button>
                </div>
            </div>
        </div>

        {/* Fullscreen Overlay */}
        {isFullscreen && (
            <div 
                className="fixed inset-0 z-50 flex flex-row cosmic-background"
                onClick={() => {
                    if (!showFullscreenControls) {
                        setShowFullscreenControls(true);
                    }
                }}
            >
                {/* Text section */}
                <div 
                    ref={fullscreenTextRef} 
                    className="w-1/2 h-full flex flex-col items-center justify-center text-center p-8 overflow-hidden"
                >
                    <p 
                        style={{ 
                            fontSize: 'calc(clamp(2.5rem, 5.5vw, 4rem) * var(--font-scale-factor, 1))', 
                            lineHeight: 1.2,
                            color: '#EAEAEA',
                            textShadow: '0 2px 8px rgba(0,0,0,0.7)'
                        }}
                        className="font-bold"
                    >
                        {slide.english}
                    </p>
                    <p 
                        style={{ 
                            fontSize: 'calc(clamp(2rem, 4.5vw, 3.5rem) * var(--font-scale-factor, 1))', 
                            lineHeight: 1.3,
                            color: '#F9D423',
                            textShadow: '0 0 12px rgba(249, 212, 35, 0.7)'
                        }}
                        className="font-hindi mt-4 font-semibold"
                    >
                        {slide.hindi}
                    </p>
                </div>
                 {/* Glowing Divider */}
                <div className="absolute left-1/2 top-10 bottom-10 w-0.5 bg-cyan-400/50" style={{ boxShadow: '0 0 15px 2px #00E5FF' }}></div>
                {/* Image section */}
                <div className="w-1/2 h-full flex items-center justify-center p-4 bg-transparent pointer-events-none">
                    {slide.imageUrl ? (
                        <img src={`data:image/png;base64,${slide.imageUrl}`} alt={slide.english} className="w-full h-full object-contain" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                             <svg className="animate-spin h-10 w-10 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="ml-4 text-lg">Working on the image...</p>
                        </div>
                    )}
                </div>
                
                {/* --- Fullscreen Controls --- */}
                <div 
                    className={`absolute inset-0 z-60 transition-opacity duration-300 ease-in-out ${showFullscreenControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={() => setShowFullscreenControls(false)}
                >
                    {/* Regenerate buttons in top left */}
                    <div
                        className="absolute top-5 left-5 flex gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={onRegenerateImage}
                            disabled={isRegenerating}
                            className="p-3 w-12 h-12 flex items-center justify-center rounded-full bg-black bg-opacity-60 text-white hover:bg-opacity-80 transition-opacity disabled:cursor-not-allowed disabled:bg-opacity-40"
                            title="Regenerate Image"
                        >
                            {isRegeneratingImage ? renderSpinner() : <RefreshIcon className="w-7 h-7" />}
                        </button>
                        <button 
                            onClick={onRegenerateTranslation}
                            disabled={isRegenerating}
                            className="p-3 w-12 h-12 flex items-center justify-center rounded-full bg-black bg-opacity-60 text-white hover:bg-opacity-80 transition-opacity disabled:cursor-not-allowed disabled:bg-opacity-40"
                            title="Regenerate Translation"
                        >
                            {isRegeneratingTranslation ? renderSpinner() : <TranslateIcon className="w-7 h-7" />}
                        </button>
                        <button 
                            onClick={onRegenerateScript}
                            disabled={isRegenerating}
                            className="p-3 w-12 h-12 flex items-center justify-center rounded-full bg-black bg-opacity-60 text-white hover:bg-opacity-80 transition-opacity disabled:cursor-not-allowed disabled:bg-opacity-40"
                            title="Regenerate Explanation & Narration"
                        >
                            {isRegeneratingScript ? renderSpinner() : <ScriptIcon className="w-7 h-7" />}
                        </button>
                    </div>

                    {/* Play/Pause Button in the center */}
                    <div 
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={handleFullscreenPlayPause} 
                            disabled={!slide.audioData || isGeneratingVideo}
                            className="w-20 h-20 flex items-center justify-center rounded-full bg-black bg-opacity-60 text-white hover:bg-opacity-80 transition-opacity disabled:bg-opacity-40 disabled:cursor-not-allowed"
                            title={lessonState === 'playing' ? "Pause" : "Play"}
                        >
                            {lessonState === 'playing' ? (
                                <PauseIcon className="w-12 h-12" />
                            ) : (
                                <PlayIcon className="w-12 h-12 ml-2" />
                            )}
                        </button>
                    </div>
                    
                    {/* Exit button in top right */}
                    <div
                        className="absolute top-5 right-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={handleFullscreen}
                            className="p-3 rounded-full bg-black bg-opacity-60 text-white hover:bg-opacity-80 transition-opacity"
                            title="Exit Fullscreen"
                        >
                            <ExitFullscreenIcon className="w-7 h-7" />
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SlideViewer;