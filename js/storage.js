/**
 * StorageManager class
 * Manages local storage for quiz history, covered topics, and user preferences
 */
class StorageManager {
    constructor() {
        this.QUIZ_HISTORY_KEY = 'interviewprep_quiz_history';
        this.COVERED_TOPICS_KEY = 'interviewprep_covered_topics';
        this.USER_PREFERENCES_KEY = 'interviewprep_user_preferences';
        
        // Initialize storage if it doesn't exist
        this.initializeStorage();
    }
    
    /**
     * Initialize storage with default values if needed
     */
    initializeStorage() {
        if (!localStorage.getItem(this.QUIZ_HISTORY_KEY)) {
            localStorage.setItem(this.QUIZ_HISTORY_KEY, JSON.stringify([]));
        }
        
        if (!localStorage.getItem(this.COVERED_TOPICS_KEY)) {
            localStorage.setItem(this.COVERED_TOPICS_KEY, JSON.stringify({}));
        }
        
        if (!localStorage.getItem(this.USER_PREFERENCES_KEY)) {
            localStorage.setItem(this.USER_PREFERENCES_KEY, JSON.stringify({
                theme: 'light',
                defaultTimeLimit: 45
            }));
        }
    }
    
    /**
     * Save a completed quiz to history
     * @param {Object} quizData - Data about the completed quiz
     */
    saveQuizToHistory(quizData) {
        const history = this.getQuizHistory();
        history.unshift(quizData); // Add to the beginning
        
        // Limit history to 20 items
        const limitedHistory = history.slice(0, 20);
        
        localStorage.setItem(this.QUIZ_HISTORY_KEY, JSON.stringify(limitedHistory));
    }
    
    /**
     * Get the quiz history
     * @returns {Array} - Array of previous quizzes
     */
    getQuizHistory() {
        const historyData = localStorage.getItem(this.QUIZ_HISTORY_KEY);
        return JSON.parse(historyData) || [];
    }
    
    /**
     * Save the map of covered topics and their frequency
     * @param {Object} topicMap - Map of topics and their frequency
     */
    saveCoveredTopics(topicMap) {
        localStorage.setItem(this.COVERED_TOPICS_KEY, JSON.stringify(topicMap));
    }
    
    /**
     * Get the map of covered topics and their frequency
     * @returns {Object} - Map of topics and their frequency
     */
    getCoveredTopics() {
        const topicData = localStorage.getItem(this.COVERED_TOPICS_KEY);
        return JSON.parse(topicData) || {};
    }
    
    /**
     * Save user preferences
     * @param {Object} preferences - User preferences
     */
    saveUserPreferences(preferences) {
        const currentPrefs = this.getUserPreferences();
        const updatedPrefs = { ...currentPrefs, ...preferences };
        
        localStorage.setItem(this.USER_PREFERENCES_KEY, JSON.stringify(updatedPrefs));
    }
    
    /**
     * Get user preferences
     * @returns {Object} - User preferences
     */
    getUserPreferences() {
        const prefsData = localStorage.getItem(this.USER_PREFERENCES_KEY);
        return JSON.parse(prefsData) || {};
    }
    
    /**
     * Clear all stored data (for debugging or reset)
     */
    clearAllData() {
        localStorage.removeItem(this.QUIZ_HISTORY_KEY);
        localStorage.removeItem(this.COVERED_TOPICS_KEY);
        localStorage.removeItem(this.USER_PREFERENCES_KEY);
        this.initializeStorage();
    }
    
    /**
     * Export all user data as JSON
     * @returns {string} - JSON string of all user data
     */
    exportUserData() {
        const exportData = {
            history: this.getQuizHistory(),
            coveredTopics: this.getCoveredTopics(),
            preferences: this.getUserPreferences(),
            exportDate: new Date().toISOString()
        };
        
        return JSON.stringify(exportData);
    }
    
    /**
     * Import user data from JSON
     * @param {string} jsonData - JSON string of user data
     * @returns {boolean} - Whether the import was successful
     */
    importUserData(jsonData) {
        try {
            const importData = JSON.parse(jsonData);
            
            // Validate the data has the expected structure
            if (!importData.history || !importData.coveredTopics || !importData.preferences) {
                return false;
            }
            
            // Import the data
            localStorage.setItem(this.QUIZ_HISTORY_KEY, JSON.stringify(importData.history));
            localStorage.setItem(this.COVERED_TOPICS_KEY, JSON.stringify(importData.coveredTopics));
            localStorage.setItem(this.USER_PREFERENCES_KEY, JSON.stringify(importData.preferences));
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }
}