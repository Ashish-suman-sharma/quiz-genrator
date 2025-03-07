/**
 * QuizGenerator class
 * Manages the generation of quiz questions and tracking of topics
 */
class QuizGenerator {
    constructor(geminiApi, storageManager) {
        this.geminiApi = geminiApi;
        this.storage = storageManager;
        this.currentQuiz = null;
        this.currentSettings = null;
    }

    /**
     * Generate a new quiz based on selected topics and question types
     * @param {Object} settings - Settings for the quiz
     * @returns {Promise<Object>} - The generated quiz
     */
    async generateQuiz(settings) {
        try {
            // Save settings for potential retry
            this.currentSettings = settings;
            
            // Get previously covered topics to avoid repetition
            const coveredTopicMap = this.storage.getCoveredTopics();
            
            // Prioritize topics that have been covered less frequently
            const topicsWithWeights = settings.topics.map(topic => {
                const timesUsed = coveredTopicMap[topic] || 0;
                return { topic, weight: 1 / (timesUsed + 1) };
            });
            
            // Normalize weights to determine distribution
            const totalWeight = topicsWithWeights.reduce((sum, t) => sum + t.weight, 0);
            const normalizedWeights = topicsWithWeights.map(t => ({
                ...t,
                normalizedWeight: t.weight / totalWeight
            }));
            
            // Generate questions via API
            const questions = await this.geminiApi.generateQuiz({
                topics: settings.topics,
                questionTypes: settings.questionTypes,
                numberOfQuestions: settings.numberOfQuestions || 25 // Use custom number of questions
            });
            
            // Create the quiz object
            const quiz = {
                id: Date.now(),
                date: new Date().toISOString(),
                settings: settings,
                questions: questions,
                currentQuestionIndex: 0,
                answers: Array(questions.length).fill(null),
                evaluations: Array(questions.length).fill(null),
                timeStarted: Date.now(),
                timeLimit: settings.timeLimit * 60 * 1000, // convert minutes to ms
                completed: false
            };
            
            // Store the current quiz
            this.currentQuiz = quiz;
            
            // Update covered topics in storage
            this.updateCoveredTopics(settings.topics);
            
            return quiz;
        } catch (error) {
            console.error("Failed to generate quiz:", error);
            throw error;
        }
    }
    
    /**
     * Update the list of covered topics for balancing future quizzes
     * @param {Array} topics - The topics used in the current quiz
     */
    updateCoveredTopics(topics) {
        const coveredTopicMap = this.storage.getCoveredTopics();
        
        topics.forEach(topic => {
            coveredTopicMap[topic] = (coveredTopicMap[topic] || 0) + 1;
        });
        
        this.storage.saveCoveredTopics(coveredTopicMap);
    }
    
    /**
     * Submit an answer for the current question
     * @param {number} questionIndex - The index of the question
     * @param {string|Object} answer - The user's answer
     */
    submitAnswer(questionIndex, answer) {
        if (!this.currentQuiz) {
            throw new Error('No active quiz');
        }
        
        // Save the answer
        this.currentQuiz.answers[questionIndex] = answer;
    }
    
    /**
     * Get the current question
     * @returns {Object} - The current question
     */
    getCurrentQuestion() {
        if (!this.currentQuiz) {
            return null;
        }
        
        return this.currentQuiz.questions[this.currentQuiz.currentQuestionIndex];
    }
    
    /**
     * Move to the next question
     * @returns {Object|null} - The next question or null if at the end
     */
    nextQuestion() {
        if (!this.currentQuiz) {
            return null;
        }
        
        if (this.currentQuiz.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuiz.currentQuestionIndex++;
            return this.getCurrentQuestion();
        }
        
        return null;
    }
    
    /**
     * Move to the previous question
     * @returns {Object|null} - The previous question or null if at the beginning
     */
    previousQuestion() {
        if (!this.currentQuiz) {
            return null;
        }
        
        if (this.currentQuiz.currentQuestionIndex > 0) {
            this.currentQuiz.currentQuestionIndex--;
            return this.getCurrentQuestion();
        }
        
        return null;
    }
    
    /**
     * Submit the quiz for evaluation
     * @returns {Promise<Object>} - Quiz results
     */
    async submitQuiz() {
        if (!this.currentQuiz) {
            throw new Error('No active quiz');
        }
        
        // Mark quiz as completed
        this.currentQuiz.completed = true;
        this.currentQuiz.timeEnded = Date.now();
        
        // Calculate time taken
        this.currentQuiz.timeTaken = this.currentQuiz.timeEnded - this.currentQuiz.timeStarted;
        
        // Evaluate all answers that haven't been evaluated yet
        const evaluationPromises = this.currentQuiz.questions.map(async (question, index) => {
            // Skip if already evaluated or no answer provided
            if (this.currentQuiz.evaluations[index] || this.currentQuiz.answers[index] === null) {
                return;
            }
            
            try {
                const evaluation = await this.geminiApi.evaluateAnswer(
                    question, 
                    this.currentQuiz.answers[index]
                );
                
                this.currentQuiz.evaluations[index] = evaluation;
            } catch (error) {
                console.error(`Error evaluating question ${index + 1}:`, error);
                // Set a default evaluation
                this.currentQuiz.evaluations[index] = {
                    correct: false,
                    score: 0,
                    explanation: "There was an error evaluating this answer."
                };
            }
        });
        
        // Wait for all evaluations to complete
        await Promise.all(evaluationPromises);
        
        // Calculate final score
        let totalScore = 0;
        let questionsAnswered = 0;
        
        this.currentQuiz.questions.forEach((_, index) => {
            if (this.currentQuiz.answers[index] !== null) {
                questionsAnswered++;
                if (this.currentQuiz.evaluations[index] && this.currentQuiz.evaluations[index].correct) {
                    totalScore++;
                }
            }
        });
        
        // Add results to the quiz object
        this.currentQuiz.totalScore = totalScore;
        this.currentQuiz.questionsAnswered = questionsAnswered;
        
        // Save the completed quiz to history
        this.storage.saveQuizToHistory({
            date: this.currentQuiz.date,
            topics: this.currentQuiz.settings.topics,
            score: totalScore,
            totalQuestions: this.currentQuiz.questions.length,
            timeTaken: this.currentQuiz.timeTaken,
            questionTypes: this.currentQuiz.settings.questionTypes
        });
        
        // Return the results
        return {
            score: totalScore,
            totalQuestions: this.currentQuiz.questions.length,
            questionsAnswered: questionsAnswered,
            timeTaken: this.currentQuiz.timeTaken,
            evaluations: this.currentQuiz.evaluations
        };
    }
    
    /**
     * Get a quiz from history and load it as the current quiz
     * @param {number} quizId - The index of the quiz in history
     * @returns {Object} - The quiz data
     */
    getQuizFromHistory(quizId) {
        const quizHistory = this.storage.getQuizHistory();
        if (quizId >= quizHistory.length) {
            throw new Error('Quiz not found in history');
        }
        
        return quizHistory[quizId];
    }
    
    /**
     * Get the current quiz data
     * @returns {Object} - The current quiz
     */
    getCurrentQuiz() {
        return this.currentQuiz;
    }
    
    /**
     * Get the settings from a previous quiz to generate a similar one
     * @param {number} quizId - The index of the quiz in history
     * @returns {Promise<Object>} - The new quiz
     */
    async retrySimilarQuiz(quizId) {
        const previousQuiz = this.getQuizFromHistory(quizId);
        
        // Use the settings from the previous quiz
        const settings = {
            topics: previousQuiz.topics,
            questionTypes: previousQuiz.questionTypes,
            timeLimit: 45 // Default to 45 minutes
        };
        
        // Generate a new quiz with those settings
        return this.generateQuiz(settings);
    }
}