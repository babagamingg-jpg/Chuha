
import React from 'react';
import { Slide, GenerationState, LessonState, GenerationProgress } from '../types';
import { PlayIcon, PauseIcon, MagicWandIcon, DownloadIcon, RefreshIcon } from './Icons';

interface ControlsProps {
  inputText: string;
  setInputText: (text: string) => void;
  contextText: string;
  setContextText: (text: string) => void;
  slides: Slide[];
  generateSlides: () => void;
  generationState: GenerationState;
  generationProgress: GenerationProgress | null;
  lessonState: LessonState;
  startLesson: () => void;
  pauseLesson: () => void;
  autoGenerateExplanation: boolean;
  setAutoGenerateExplanation: (value: boolean) => void;
  onDownloadVideo: () => void;
  isGeneratingVideo: boolean;
  videoGenerationProgress: number;
  onNewLesson: () => void;
}

const GenerationButton: React.FC<{onClick: () => void; disabled: boolean; state: GenerationState; children: React.ReactNode;}> = ({onClick, disabled, state, children}) => {
    const isLoading = ['processing', 'translating', 'explaining', 'imaging', 'narrating'].includes(state);
    return (
        <button
            onClick={onClick}
            disabled={disabled || isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 text-black font-bold rounded-lg shadow-lg hover:bg-teal-400 disabled:bg-teal-800 disabled:cursor-not-allowed disabled:text-gray-400 transition-all transform hover:scale-105"
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="http://www.w3.org/2000/svg">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating...</span>
                </>
            ) : children}
        </button>
    );
}


const Controls: React.FC<ControlsProps> = ({
  inputText,
  setInputText,
  contextText,
  setContextText,
  slides,
  generateSlides,
  generationState,
  generationProgress,
  lessonState,
  startLesson,
  pauseLesson,
  autoGenerateExplanation,
  setAutoGenerateExplanation,
  onDownloadVideo,
  isGeneratingVideo,
  videoGenerationProgress,
  onNewLesson,
}) => {
  
  const isGenerating = ['processing', 'translating', 'explaining', 'imaging', 'narrating'].includes(generationState);
  const isLessonReady = slides.length > 0 && generationState === 'done';
  const isLessonGenerated = slides.length > 0;

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-black/20 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 text-gray-200">
      <h2 className="text-2xl font-bold text-white flex-shrink-0">
        {isLessonGenerated ? "Lesson Controls" : "Lesson Creator"}
      </h2>
      
      {isLessonGenerated ? (
        // VIEW AFTER LESSON IS GENERATED
        <div className="flex-grow flex flex-col justify-between min-h-0">
            <div className="space-y-4 overflow-y-auto pr-2">
                <div className="flex justify-center py-2">
                {lessonState === 'playing' ? (
                    <button onClick={pauseLesson} className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg shadow-md hover:bg-yellow-400 disabled:bg-gray-400 transition-colors w-40" disabled={!slides.length || isGenerating}>
                        <PauseIcon className="w-5 h-5"/> Pause
                    </button>
                ) : (
                    <button onClick={startLesson} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-500 disabled:bg-gray-400 transition-colors w-40" disabled={!isLessonReady}>
                        <PlayIcon className="w-5 h-5"/> {lessonState === 'paused' ? 'Resume' : 'Start Lesson'}
                    </button>
                )}
                </div>
                
                <div className="pt-4 border-t border-white/10 space-y-2">
                    <button 
                        onClick={onDownloadVideo}
                        disabled={!isLessonReady || isGeneratingVideo}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {isGeneratingVideo ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating Video...
                        </>
                      ) : (
                        <>
                          <DownloadIcon className="w-5 h-5"/> Download Video
                        </>
                      )}
                    </button>
                    {isGeneratingVideo && (
                    <div>
                      <div className="w-full bg-gray-700/50 rounded-full h-2.5">
                          <div 
                              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
                              style={{ width: `${videoGenerationProgress * 100}%` }}>
                          </div>
                      </div>
                      <p className="text-xs text-center mt-1 text-gray-400">Rendering slide {Math.ceil(videoGenerationProgress * slides.length)} of {slides.length}</p>
                    </div>
                    )}
                </div>
            </div>

            <div className="flex-shrink-0 pt-4">
                <button
                    onClick={onNewLesson}
                    disabled={isGenerating || isGeneratingVideo}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed transition-all"
                >
                    <RefreshIcon className="w-5 h-5"/> Start New Lesson
                </button>
            </div>
        </div>
      ) : (
        // VIEW BEFORE GENERATION / DURING GENERATION
        <div className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2 min-h-0">
            <label htmlFor="context-text" className="block text-sm font-medium text-gray-300">
                Previous Chapter Context (Optional)
            </label>
            <textarea
              id="context-text"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Paste text from the previous lesson for better continuity..."
              className="w-full p-3 border border-white/20 rounded-lg bg-black/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              rows={5}
              disabled={isGenerating}
            />
            
            <label htmlFor="lesson-text" className="block text-sm font-medium text-gray-300">
              Paste English Lesson Text
            </label>
            <textarea
              id="lesson-text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g., The woods are lovely, dark and deep..."
              className="w-full flex-grow p-3 border border-white/20 rounded-lg bg-black/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              rows={8}
              disabled={isGenerating}
            />

            {generationProgress && (
                <div className="w-full flex-shrink-0">
                    <div className="w-full bg-gray-700/50 rounded-full h-2.5">
                        <div 
                            className="bg-teal-500 h-2.5 rounded-full transition-all duration-500" 
                            style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}>
                        </div>
                    </div>
                    <p className="text-xs text-center mt-1 text-gray-400">{generationProgress.step}: {generationProgress.current}/{generationProgress.total}</p>
                </div>
            )}
            
            <label htmlFor="auto-generate-explanation" className="flex items-center justify-between cursor-pointer flex-shrink-0">
              <span className="text-sm font-medium text-gray-300">
                Auto-generate Hindi Explanation
              </span>
              <div className="relative">
                <input 
                  id="auto-generate-explanation" 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={autoGenerateExplanation}
                  onChange={(e) => setAutoGenerateExplanation(e.target.checked)}
                  disabled={isGenerating}
                />
                <div className="w-11 h-6 bg-gray-700/50 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-400 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              </div>
            </label>
            
            <div className="flex-shrink-0">
                <GenerationButton onClick={generateSlides} disabled={!inputText} state={generationState}>
                    <MagicWandIcon className="w-5 h-5"/> Generate Lesson
                </GenerationButton>
            </div>
        </div>
      )}
    </div>
  );
};

export default Controls;