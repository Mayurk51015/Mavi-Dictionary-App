/* ============================================
   DICTIONARY APP - VANILLA JAVASCRIPT
   Production-ready modular architecture
   ============================================ */

/* ============================================
   CONFIGURATION & CONSTANTS
   ============================================ */
// Free Dictionary API (No API key required!)
const CONFIG = {
    API_URL: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
    DEBOUNCE_DELAY: 500,
    CACHE_DURATION: 3600000,
    MAX_CACHE_SIZE: 50
};

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */
const Utils = {
    /**
     * Debounce function to limit API calls
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    },

    /**
     * Sanitize user input to prevent XSS
     * @param {string} str - String to sanitize
     * @returns {string} Sanitized string
     */
    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    /**
     * Show element with animation
     * @param {HTMLElement} element - Element to show
     */
    show(element) {
        element.setAttribute('aria-hidden', 'false');
        element.style.display = '';
    },

    /**
     * Hide element with animation
     * @param {HTMLElement} element - Element to hide
     */
    hide(element) {
        element.setAttribute('aria-hidden', 'true');
        element.style.display = 'none';
    },

    /**
     * Announce to screen readers
     * @param {string} message - Message to announce
     */
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);
    }
};

/* ============================================
   CACHE MANAGER
   ============================================ */
const CacheManager = {
    cache: new Map(),

    /**
     * Get cached data if valid
     * @param {string} key - Cache key
     * @returns {any|null} Cached data or null
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        const isExpired = Date.now() - item.timestamp > CONFIG.CACHE_DURATION;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    },

    /**
     * Set cache data
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     */
    set(key, data) {
        // Limit cache size
        if (this.cache.size >= CONFIG.MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    },

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }
};

/* ============================================
   API SERVICE
   ============================================ */
const APIService = {
    /**
     * Fetch word definition from API
     * @param {string} word - Word to look up
     * @returns {Promise<Array>} Word data
     */
    async fetchWord(word) {
        const cachedData = CacheManager.get(word);
        if (cachedData) {
            console.log('Using cached data for:', word);
            return cachedData;
        }

        try {
            const response = await fetch(`${CONFIG.API_URL}${encodeURIComponent(word)}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Word not found. Please check your spelling and try again.');
                }
                throw new Error('Network error. Please check your connection and try again.');
            }

            const data = await response.json();

            // Free Dictionary API returns data in the correct format already
            CacheManager.set(word, data);
            return data;
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Unable to connect to the dictionary service. Please check your internet connection.');
            }
            throw error;
        }
    }


};

/* ============================================
   AUDIO SERVICE
   ============================================ */
const AudioService = {
    currentAudio: null,

    /**
     * Play pronunciation audio
     * @param {string} url - Audio URL
     */
    playAudio(url) {
        // Stop current audio if playing
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }

        this.currentAudio = new Audio(url);
        this.currentAudio.play().catch(error => {
            console.error('Audio playback failed:', error);
            UI.showError('Audio playback failed', 'Unable to play pronunciation audio.');
        });
    },

    /**
     * Use browser Text-to-Speech
     * @param {string} word - Word to pronounce
     */
    speakWord(word) {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8; // Slightly slower for clarity

            window.speechSynthesis.speak(utterance);
        } else {
            UI.showError('Not supported', 'Text-to-speech is not supported in your browser.');
        }
    }
};

/* ============================================
   UI CONTROLLER
   ============================================ */
const UI = {
    elements: {
        searchInput: document.getElementById('search-input'),
        searchBtn: document.getElementById('search-btn'),
        loadingContainer: document.getElementById('loading-indicator'),
        errorContainer: document.getElementById('error-container'),
        errorTitle: document.getElementById('error-title'),
        errorMessage: document.getElementById('error-message'),
        dismissError: document.getElementById('dismiss-error'),
        resultsContainer: document.getElementById('results-container')
    },

    /**
     * Show loading state
     */
    showLoading() {
        Utils.show(this.elements.loadingContainer);
        Utils.hide(this.elements.errorContainer);
        this.elements.resultsContainer.innerHTML = '';
        Utils.announceToScreenReader('Searching for word definition');
    },

    /**
     * Hide loading state
     */
    hideLoading() {
        Utils.hide(this.elements.loadingContainer);
    },

    /**
     * Show error message
     * @param {string} title - Error title
     * @param {string} message - Error message
     */
    showError(title, message) {
        this.hideLoading();
        this.elements.resultsContainer.innerHTML = '';
        this.elements.errorTitle.textContent = title;
        this.elements.errorMessage.textContent = message;
        Utils.show(this.elements.errorContainer);
        Utils.announceToScreenReader(`Error: ${title}. ${message}`);
    },

    /**
     * Hide error message
     */
    hideError() {
        Utils.hide(this.elements.errorContainer);
    },

    /**
     * Render word results
     * @param {Array} data - Word data from API
     */
    renderResults(data) {
        this.hideLoading();
        this.hideError();

        if (!data || data.length === 0) {
            this.showError('No results', 'No definitions found for this word.');
            return;
        }

        const wordData = data[0];
        const html = this.buildResultsHTML(wordData);
        this.elements.resultsContainer.innerHTML = html;

        // Attach event listeners after rendering
        this.attachResultEventListeners(wordData);

        // Announce results to screen readers
        Utils.announceToScreenReader(`Found ${data.length} result${data.length > 1 ? 's' : ''} for ${wordData.word}`);

        // Smooth scroll to results
        this.elements.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    /**
     * Build HTML for results
     * @param {Object} wordData - Word data
     * @returns {string} HTML string
     */
    buildResultsHTML(wordData) {
        const word = Utils.sanitizeHTML(wordData.word);
        const phonetic = wordData.phonetic ? Utils.sanitizeHTML(wordData.phonetic) : '';

        // Get audio URLs
        const audioURLs = this.extractAudioURLs(wordData);

        let html = `
            <div class="word-header glass-card">
                <h2 class="word-title">${word}</h2>
                ${phonetic ? `<p class="phonetic-text">${phonetic}</p>` : ''}
                <div class="audio-controls">
                    ${this.buildAudioButtonsHTML(audioURLs, word)}
                </div>
            </div>
        `;

        // Render meanings
        html += '<div class="meanings-section">';
        wordData.meanings.forEach((meaning, index) => {
            html += this.buildMeaningHTML(meaning, index);
        });
        html += '</div>';

        // Render synonyms if available
        const allSynonyms = this.extractAllSynonyms(wordData.meanings);
        if (allSynonyms.length > 0) {
            html += this.buildSynonymsHTML(allSynonyms);
        }

        return html;
    },

    /**
     * Extract audio URLs from word data
     * @param {Object} wordData - Word data
     * @returns {Array} Array of audio URLs
     */
    extractAudioURLs(wordData) {
        const audioURLs = [];
        if (wordData.phonetics) {
            wordData.phonetics.forEach(phonetic => {
                if (phonetic.audio) {
                    audioURLs.push(phonetic.audio);
                }
            });
        }
        return audioURLs;
    },

    /**
     * Build HTML for audio buttons
     * @param {Array} audioURLs - Array of audio URLs
     * @param {string} word - Word for TTS fallback
     * @returns {string} HTML string
     */
    buildAudioButtonsHTML(audioURLs, word) {
        let html = '';

        if (audioURLs.length > 0) {
            audioURLs.forEach((url, index) => {
                html += `
                    <button class="audio-btn" data-audio-url="${url}" aria-label="Play pronunciation ${index + 1}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                        Audio ${index + 1}
                    </button>
                `;
            });
        }

        // Always provide TTS fallback
        html += `
            <button class="audio-btn" data-tts-word="${word}" aria-label="Pronounce using text-to-speech">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
                Text-to-Speech
            </button>
        `;

        return html;
    },

    /**
     * Build HTML for a single meaning
     * @param {Object} meaning - Meaning object
     * @param {number} index - Meaning index
     * @returns {string} HTML string
     */
    buildMeaningHTML(meaning, index) {
        const partOfSpeech = Utils.sanitizeHTML(meaning.partOfSpeech);

        let html = `
            <div class="meaning-card glass-card">
                <span class="part-of-speech">${partOfSpeech}</span>
                <ul class="definitions-list">
        `;

        meaning.definitions.forEach((def, defIndex) => {
            const definition = Utils.sanitizeHTML(def.definition);
            const example = def.example ? Utils.sanitizeHTML(def.example) : null;

            html += `
                <li class="definition-item">
                    <p class="definition-text">
                        <span class="definition-number">${defIndex + 1}.</span>
                        ${definition}
                    </p>
                    ${example ? `
                        <p class="example-text">
                            <span class="example-label">Example:</span> "${example}"
                        </p>
                    ` : ''}
                </li>
            `;
        });

        html += `
                </ul>
            </div>
        `;

        return html;
    },

    /**
     * Extract all synonyms from meanings
     * @param {Array} meanings - Array of meanings
     * @returns {Array} Array of unique synonyms
     */
    extractAllSynonyms(meanings) {
        const synonymsSet = new Set();

        meanings.forEach(meaning => {
            if (meaning.synonyms) {
                meaning.synonyms.forEach(synonym => synonymsSet.add(synonym));
            }
            if (meaning.definitions) {
                meaning.definitions.forEach(def => {
                    if (def.synonyms) {
                        def.synonyms.forEach(synonym => synonymsSet.add(synonym));
                    }
                });
            }
        });

        return Array.from(synonymsSet);
    },

    /**
     * Build HTML for synonyms section
     * @param {Array} synonyms - Array of synonyms
     * @returns {string} HTML string
     */
    buildSynonymsHTML(synonyms) {
        let html = `
            <div class="synonyms-section glass-card">
                <h3 class="synonyms-title">Synonyms</h3>
                <div class="synonyms-list">
        `;

        synonyms.forEach(synonym => {
            const sanitized = Utils.sanitizeHTML(synonym);
            html += `<span class="synonym-tag" data-synonym="${sanitized}">${sanitized}</span>`;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Attach event listeners to result elements
     * @param {Object} wordData - Word data
     */
    attachResultEventListeners(wordData) {
        // Audio buttons
        const audioButtons = document.querySelectorAll('.audio-btn[data-audio-url]');
        audioButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.getAttribute('data-audio-url');
                AudioService.playAudio(url);
            });
        });

        // TTS buttons
        const ttsButtons = document.querySelectorAll('.audio-btn[data-tts-word]');
        ttsButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const word = btn.getAttribute('data-tts-word');
                AudioService.speakWord(word);
            });
        });

        // Synonym tags (clickable to search)
        const synonymTags = document.querySelectorAll('.synonym-tag');
        synonymTags.forEach(tag => {
            tag.addEventListener('click', () => {
                const synonym = tag.getAttribute('data-synonym');
                UI.elements.searchInput.value = synonym;
                App.handleSearch();
            });

            // Make keyboard accessible
            tag.setAttribute('tabindex', '0');
            tag.setAttribute('role', 'button');
            tag.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const synonym = tag.getAttribute('data-synonym');
                    UI.elements.searchInput.value = synonym;
                    App.handleSearch();
                }
            });
        });
    }
};

/* ============================================
   MAIN APPLICATION CONTROLLER
   ============================================ */
const App = {
    /**
     * Initialize the application
     */
    init() {
        this.attachEventListeners();
        this.setupKeyboardNavigation();
        console.log('Dictionary App initialized');
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Search button click
        UI.elements.searchBtn.addEventListener('click', () => this.handleSearch());

        // Enter key press on search input
        UI.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSearch();
            }
        });

        // Debounced input validation
        const debouncedValidation = Utils.debounce(() => {
            this.validateInput();
        }, CONFIG.DEBOUNCE_DELAY);

        UI.elements.searchInput.addEventListener('input', debouncedValidation);

        // Dismiss error button
        UI.elements.dismissError.addEventListener('click', () => {
            UI.hideError();
        });

        // Clear input on focus if it's the first interaction
        UI.elements.searchInput.addEventListener('focus', function () {
            this.select();
        }, { once: true });
    },

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        // Escape key to close error
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                UI.hideError();
            }
        });
    },

    /**
     * Validate search input
     */
    validateInput() {
        const word = UI.elements.searchInput.value.trim();

        if (word.length === 0) {
            UI.elements.searchBtn.disabled = false;
            return;
        }

        // Check for invalid characters
        const validPattern = /^[a-zA-Z\s-']+$/;
        if (!validPattern.test(word)) {
            UI.elements.searchInput.setAttribute('aria-invalid', 'true');
        } else {
            UI.elements.searchInput.removeAttribute('aria-invalid');
        }
    },

    /**
     * Handle search action
     */
    async handleSearch() {
        const word = UI.elements.searchInput.value.trim().toLowerCase();

        // Validation
        if (!word) {
            UI.showError('Empty Input', 'Please enter a word to search.');
            UI.elements.searchInput.focus();
            return;
        }

        // Check for invalid characters
        const validPattern = /^[a-zA-Z\s-']+$/;
        if (!validPattern.test(word)) {
            UI.showError('Invalid Input', 'Please enter a valid word using only letters, spaces, hyphens, and apostrophes.');
            UI.elements.searchInput.focus();
            return;
        }

        // Show loading state
        UI.showLoading();

        try {
            // Fetch word data
            const data = await APIService.fetchWord(word);

            // Render results
            UI.renderResults(data);

        } catch (error) {
            console.error('Search error:', error);
            UI.showError('Search Failed', error.message);
        }
    }
}

/* ============================================
   THEME TOGGLE FUNCTIONALITY
   ============================================ */
const ThemeToggle = {
    init() {
        this.themeToggleBtn = document.getElementById('theme-toggle');
        this.loadTheme();
        this.attachEventListeners();
    },

    loadTheme() {
        const savedTheme = localStorage.getItem('dictionary-theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        }
    },

    toggleTheme() {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('dictionary-theme', isLight ? 'light' : 'dark');
    },

    attachEventListeners() {
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }
    }
};

/* ============================================
   APPLICATION INITIALIZATION
   ============================================ */
// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
        ThemeToggle.init();
    });
} else {
    App.init();
    ThemeToggle.init();
}

// Export for potential testing or extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { App, Utils, CacheManager, APIService, AudioService, UI };
}
