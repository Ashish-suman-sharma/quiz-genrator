/**
 * QuizUI class
 * Handles the user interface for the quiz, including question display and interaction
 */
class QuizUI {
    constructor(quizGenerator, storageManager) {
        this.quizGenerator = quizGenerator;
        this.storage = storageManager;
        this.timer = null;
        this.remainingTime = 0;
    }
    
    /**
     * Initialize the UI and attach event listeners
     */
    init() {
        // Button event listeners
        document.getElementById('start-quiz').addEventListener('click', () => this.showQuizSettings());
        document.getElementById('generate-quiz').addEventListener('click', () => this.startNewQuiz());
        document.getElementById('prev-question').addEventListener('click', () => this.showPreviousQuestion());
        document.getElementById('next-question').addEventListener('click', () => this.showNextQuestion());
        document.getElementById('submit-quiz').addEventListener('click', () => this.submitQuiz());
        document.getElementById('new-quiz').addEventListener('click', () => this.resetQuiz());
        document.getElementById('review-answers').addEventListener('click', () => this.toggleReviewSection());
        
        // Check if Gemini API is configured, if not, prompt the user
        if (!this.quizGenerator.geminiApi.loadSavedApiKey()) {
            this.promptForApiKey();
        }
    }
    
    /**
     * Show the API key configuration prompt
     */
    promptForApiKey() {
        // Create a modal for API key input
        const modal = document.createElement('div');
        modal.className = 'api-key-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Gemini API Key Required</h2>
                <p>To generate interview questions, you need to provide a Google Gemini API key.</p>
                <ol>
                    <li>Go to <a href="https://ai.google.dev/" target="_blank">Google AI Studio</a></li>
                    <li>Create an account or sign in</li>
                    <li>Get an API key from the API keys section</li>
                </ol>
                <div class="input-group">
                    <label for="api-key-input">Enter your Gemini API Key:</label>
                    <input type="text" id="api-key-input" placeholder="API Key">
                </div>
                <div class="modal-actions">
                    <button id="save-api-key" class="btn-primary">Save Key</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener to save button
        document.getElementById('save-api-key').addEventListener('click', () => {
            const apiKey = document.getElementById('api-key-input').value.trim();
            if (apiKey) {
                this.quizGenerator.geminiApi.configure(apiKey);
                document.body.removeChild(modal);
            } else {
                alert('Please enter a valid API key');
            }
        });
    }
    
    /**
     * Show the quiz settings section
     */
    showQuizSettings() {
        document.getElementById('hero').classList.add('hidden');
        document.getElementById('quiz-settings').classList.remove('hidden');
    }
    
    /**
     * Start a new quiz with the selected settings
     */
    async startNewQuiz() {
        try {
            // Check if API is configured
            if (!this.quizGenerator.geminiApi.isApiConfigured()) {
                this.promptForApiKey();
                return;
            }
            
            // Get selected topics
            const selectedTopics = Array.from(
                document.querySelectorAll('input[name="topic"]:checked')
            ).map(input => input.value);
            
            // Get custom topic
            const customTopic = document.getElementById('custom-topic').value.trim();
            if (customTopic) {
                selectedTopics.push(customTopic);
            }
            
            if (selectedTopics.length === 0) {
                alert('Please select at least one topic');
                return;
            }
            
            // Get selected question types
            const selectedTypes = Array.from(
                document.querySelectorAll('input[name="type"]:checked')
            ).map(input => input.value);
            
            if (selectedTypes.length === 0) {
                alert('Please select at least one question type');
                return;
            }
            
            // Get number of questions
            const numberOfQuestions = parseInt(document.getElementById('num-questions').value);
            
            // Get time limit
            const timeLimit = parseInt(document.getElementById('time-limit').value);
            
            // Settings object
            const settings = {
                topics: selectedTopics,
                questionTypes: selectedTypes,
                numberOfQuestions: numberOfQuestions,
                timeLimit: timeLimit
            };
            
            // Hide settings, show quiz container with loading state
            document.getElementById('quiz-settings').classList.add('hidden');
            document.getElementById('quiz-container').classList.remove('hidden');
            document.getElementById('question-container').innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Generating your quiz with Gemini AI...</p>
                </div>
            `;
            
            // Generate quiz
            const quiz = await this.quizGenerator.generateQuiz(settings);
            
            // Update UI with the first question
            this.updateQuizUI(quiz);
            
            // Start the timer
            this.startTimer(timeLimit);
            
            // Enable navigation buttons
            document.getElementById('next-question').disabled = false;
        } catch (error) {
            console.error('Error starting quiz:', error);
            alert(`Failed to generate quiz: ${error.message}`);
            
            // Go back to settings screen
            document.getElementById('quiz-container').classList.add('hidden');
            document.getElementById('quiz-settings').classList.remove('hidden');
        }
    }
    
    /**
     * Update the quiz UI with the current question
     * @param {Object} quiz - The quiz object
     */
    updateQuizUI(quiz) {
        const currentQuestion = quiz.questions[quiz.currentQuestionIndex];
        const questionContainer = document.getElementById('question-container');
        const prevButton = document.getElementById('prev-question');
        const nextButton = document.getElementById('next-question');
        const submitButton = document.getElementById('submit-quiz');
        
        // Update progress indicators
        document.getElementById('current-question').textContent = quiz.currentQuestionIndex + 1;
        document.getElementById('total-questions').textContent = quiz.questions.length;
        
        // Update progress bar
        const progressPercentage = ((quiz.currentQuestionIndex + 1) / quiz.questions.length) * 100;
        document.querySelector('.progress-fill').style.width = `${progressPercentage}%`;
        
        // Create question HTML based on type
        let questionHTML = `
            <div class="question-card" id="question-${currentQuestion.id}">
                <div class="question-header">
                    <span class="question-type ${currentQuestion.type}">${this.formatQuestionType(currentQuestion.type)}</span>
                    <span class="question-number">Question ${quiz.currentQuestionIndex + 1} of ${quiz.questions.length}</span>
                </div>
                <div class="question-text">${currentQuestion.question}</div>
        `;
        
        // Add type-specific content
        if (currentQuestion.type === 'mcq') {
            questionHTML += this.createMCQContent(currentQuestion, quiz.answers[quiz.currentQuestionIndex]);
        } else if (currentQuestion.type === 'coding') {
            questionHTML += this.createCodingContent(currentQuestion, quiz.answers[quiz.currentQuestionIndex]);
        } else if (currentQuestion.type === 'theory') {
            questionHTML += this.createTheoryContent(currentQuestion, quiz.answers[quiz.currentQuestionIndex]);
        }
        
        questionHTML += '</div>';
        
        // Update the question container
        questionContainer.innerHTML = questionHTML;
        
        // Add event listeners for answer selection
        if (currentQuestion.type === 'mcq') {
            document.querySelectorAll('.option-item').forEach(option => {
                option.addEventListener('click', () => {
                    if (quiz.completed) return; // Don't allow changes after submission
                    
                    // Remove selected class from all options
                    document.querySelectorAll('.option-item').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    
                    // Add selected class to clicked option
                    option.classList.add('selected');
                    
                    // Save the answer
                    const selectedLetter = option.dataset.letter;
                    this.quizGenerator.submitAnswer(quiz.currentQuestionIndex, selectedLetter);
                });
            });
        } else if (currentQuestion.type === 'coding' || currentQuestion.type === 'theory') {
            const textarea = document.querySelector('.code-editor textarea, .theory-answer textarea');
            textarea.addEventListener('input', () => {
                this.quizGenerator.submitAnswer(quiz.currentQuestionIndex, textarea.value);
            });
        }
        
        // Update navigation buttons
        prevButton.disabled = quiz.currentQuestionIndex === 0;
        
        // Show submit button on last question
        if (quiz.currentQuestionIndex === quiz.questions.length - 1) {
            nextButton.classList.add('hidden');
            submitButton.classList.remove('hidden');
        } else {
            nextButton.classList.remove('hidden');
            submitButton.classList.add('hidden');
        }
    }
    
    /**
     * Create HTML content for MCQ question type
     * @param {Object} question - The question object
     * @param {string} selectedAnswer - The user's selected answer
     * @returns {string} - HTML for the MCQ content
     */
    createMCQContent(question, selectedAnswer) {
        let html = '<ul class="options-list">';
        
        question.options.forEach(option => {
            const isSelected = selectedAnswer === option.letter;
            const selectedClass = isSelected ? 'selected' : '';
            
            html += `
                <li class="option-item ${selectedClass}" data-letter="${option.letter}">
                    <span class="option-letter">${option.letter}.</span>
                    <span class="option-text">${option.text}</span>
                </li>
            `;
        });
        
        html += '</ul>';
        return html;
    }
    
    /**
     * Create HTML content for coding question type
     * @param {Object} question - The question object
     * @param {string} userCode - The user's code
     * @returns {string} - HTML for the coding content
     */
    createCodingContent(question, userCode) {
        let html = '<div class="code-editor">';
        
        html += `
            <textarea id="code-editor">${userCode || question.starterCode || '// Write your solution here'}</textarea>
        `;
        
        html += '</div>';
        
        // Add sample test cases if available
        if (question.sampleCases && question.sampleCases.length > 0) {
            html += '<div class="sample-cases">';
            html += '<h4>Sample Test Cases:</h4>';
            html += '<ul>';
            
            question.sampleCases.forEach(testCase => {
                html += `
                    <li>
                        <strong>Input:</strong> ${testCase.input}<br>
                        <strong>Expected Output:</strong> ${testCase.output}
                    </li>
                `;
            });
            
            html += '</ul></div>';
        }

        // Initialize CodeMirror after the content is added to the DOM
        setTimeout(() => {
            const editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
                mode: 'javascript',
                lineNumbers: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                indentUnit: 4,
                tabSize: 4,
                spellcheck: false
            });

            editor.on('change', () => {
                this.quizGenerator.submitAnswer(question.id - 1, editor.getValue());
            });
        }, 0);

        return html;
    }
    
    /**
     * Create HTML content for theory question type
     * @param {Object} question - The question object
     * @param {string} userAnswer - The user's answer
     * @returns {string} - HTML for the theory content
     */
    createTheoryContent(question, userAnswer) {
        let html = '<div class="theory-answer">';
        
        html += `
            <textarea placeholder="Type your answer here...">${userAnswer || ''}</textarea>
        `;
        
        html += '</div>';
        
        // Add key points if available
        if (question.keyPoints && question.keyPoints.length > 0) {
            html += '<div class="key-points">';
            html += '<h4>Key Points to Consider:</h4>';
            html += '<ul>';
            
            question.keyPoints.forEach(point => {
                html += `<li>${point}</li>`;
            });
            
            html += '</ul></div>';
        }
        
        return html;
    }
    
    /**
     * Format the question type for display
     * @param {string} type - The question type
     * @returns {string} - Formatted question type
     */
    formatQuestionType(type) {
        const typeMap = {
            'mcq': 'Multiple Choice',
            'coding': 'Coding Challenge',
            'theory': 'Theory Question'
        };
        
        return typeMap[type] || type;
    }
    
    /**
     * Start the quiz timer
     * @param {number} timeLimit - Time limit in minutes
     */
    startTimer(timeLimit) {
        // Clear any existing timer
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // Convert minutes to milliseconds
        const timeInMs = timeLimit * 60 * 1000;
        const endTime = Date.now() + timeInMs;
        
        // Update the timer every second
        this.timer = setInterval(() => {
            const now = Date.now();
            this.remainingTime = Math.max(0, endTime - now);
            
            // Format time as MM:SS
            const minutes = Math.floor(this.remainingTime / 60000);
            const seconds = Math.floor((this.remainingTime % 60000) / 1000);
            
            document.getElementById('time-remaining').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Auto-submit when time runs out
            if (this.remainingTime <= 0) {
                clearInterval(this.timer);
                alert('Time is up! Submitting your quiz.');
                this.submitQuiz();
            }
        }, 1000);
    }
    
    /**
     * Show the previous question
     */
    showPreviousQuestion() {
        const quiz = this.quizGenerator.getCurrentQuiz();
        if (!quiz) return;
        
        this.quizGenerator.previousQuestion();
        this.updateQuizUI(quiz);
    }
    
    /**
     * Show the next question
     */
    showNextQuestion() {
        const quiz = this.quizGenerator.getCurrentQuiz();
        if (!quiz) return;
        
        this.quizGenerator.nextQuestion();
        this.updateQuizUI(quiz);
    }
    
    /**
     * Submit the quiz and show results
     */
    async submitQuiz() {
        try {
            // Stop the timer
            if (this.timer) {
                clearInterval(this.timer);
            }
            
            // Show loading state
            document.getElementById('question-container').innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Evaluating your answers with Gemini AI...</p>
                </div>
            `;
            
            document.getElementById('next-question').disabled = true;
            document.getElementById('prev-question').disabled = true;
            document.getElementById('submit-quiz').disabled = true;
            
            // Submit quiz for evaluation
            const results = await this.quizGenerator.submitQuiz();
            
            // Show results page
            this.showQuizResults(results);
        } catch (error) {
            console.error('Error submitting quiz:', error);
            alert(`Failed to evaluate quiz: ${error.message}`);
        }
    }
    
    /**
     * Show the quiz results
     * @param {Object} results - Quiz results
     */
        /**
     * Show the quiz results
     * @param {Object} results - Quiz results
     */
        showQuizResults(results) {
            // Hide quiz container, show results container
            document.getElementById('quiz-container').classList.add('hidden');
            document.getElementById('results-container').classList.remove('hidden');
            
            // Update score display
            const scorePercentage = Math.round((results.score / results.totalQuestions) * 100);
            document.getElementById('score-percentage').textContent = `${scorePercentage}%`;
            
            // Update circle progress
            const circumference = 2 * Math.PI * 54; // 54 is the radius of the circle
            const offset = circumference - (scorePercentage / 100) * circumference;
            document.querySelector('.score-circle-fill').style.strokeDasharray = circumference;
            document.querySelector('.score-circle-fill').style.strokeDashoffset = offset;
            
            // Update summary stats
            document.getElementById('correct-answers').textContent = results.score;
            document.getElementById('incorrect-answers').textContent = results.questionsAnswered - results.score;
            document.getElementById('unanswered').textContent = results.totalQuestions - results.questionsAnswered;
            
            // Format time spent
            const timeTaken = results.timeTaken;
            const minutes = Math.floor(timeTaken / 60000);
            const seconds = Math.floor((timeTaken % 60000) / 1000);
            document.getElementById('time-spent').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Generate review content
            this.generateReviewContent(results);
        }
        
        /**
         * Generate the review content for the results page
         * @param {Object} results - Quiz results
         */
        generateReviewContent(results) {
            const quiz = this.quizGenerator.getCurrentQuiz();
            if (!quiz) return;
            
            const reviewContainer = document.getElementById('review-questions');
            reviewContainer.innerHTML = '';
            
            quiz.questions.forEach((question, index) => {
                const userAnswer = quiz.answers[index];
                const evaluation = quiz.evaluations[index];
                
                // Skip if no answer was provided
                if (userAnswer === null) return;
                
                const isCorrect = evaluation && evaluation.correct;
                const reviewItem = document.createElement('div');
                reviewItem.className = `review-item ${isCorrect ? 'correct' : 'incorrect'}`;
                
                let answerHtml = '';
                if (question.type === 'mcq') {
                    // For MCQs, show the selected option and the correct option
                    const selectedOption = question.options.find(opt => opt.letter === userAnswer);
                    const correctOption = question.options.find(opt => opt.letter === question.correctAnswer);
                    
                    answerHtml = `
                        <p><strong>Your Answer:</strong> ${selectedOption ? `${userAnswer}. ${selectedOption.text}` : 'None'}</p>
                        <p><strong>Correct Answer:</strong> ${question.correctAnswer}. ${correctOption.text}</p>
                    `;
                } else if (question.type === 'coding') {
                    // For coding, show the user's code
                    answerHtml = `
                        <p><strong>Your Answer:</strong></p>
                        <pre><code>${userAnswer}</code></pre>
                    `;
                } else if (question.type === 'theory') {
                    // For theory, show the user's answer
                    answerHtml = `
                        <p><strong>Your Answer:</strong></p>
                        <div class="theory-response">${userAnswer}</div>
                    `;
                }
                
                reviewItem.innerHTML = `
                    <div class="review-question">${question.question}</div>
                    <div class="review-answer">
                        ${answerHtml}
                    </div>
                    <div class="review-details">
                        <p><strong>Result:</strong> ${isCorrect ? 'Correct' : 'Incorrect'}</p>
                        <div class="review-explanation">
                            <p><strong>Explanation:</strong></p>
                            <p>${evaluation ? evaluation.explanation : 'No explanation available.'}</p>
                        </div>
                    </div>
                `;
                
                reviewContainer.appendChild(reviewItem);
            });
        }
        
        /**
         * Toggle the visibility of the review section
         */
        toggleReviewSection() {
            const reviewContainer = document.getElementById('review-container');
            const reviewButton = document.getElementById('review-answers');
            
            if (reviewContainer.classList.contains('hidden')) {
                reviewContainer.classList.remove('hidden');
                reviewButton.textContent = 'Hide Review';
            } else {
                reviewContainer.classList.add('hidden');
                reviewButton.textContent = 'Review Answers';
            }
        }
        
        /**
         * Reset the quiz and return to the settings page
         */
        resetQuiz() {
            // Clear any active timer
            if (this.timer) {
                clearInterval(this.timer);
            }
            
            // Hide results, show settings
            document.getElementById('results-container').classList.add('hidden');
            document.getElementById('quiz-settings').classList.remove('hidden');
        }
        
        /**
         * View a quiz from history
         * @param {number} quizId - The index of the quiz in history
         */
        viewQuizFromHistory(quizId) {
            try {
                const historyQuiz = this.quizGenerator.getQuizFromHistory(quizId);
                
                // Show the results container
                document.getElementById('hero').classList.add('hidden');
                document.getElementById('quiz-settings').classList.add('hidden');
                document.getElementById('quiz-container').classList.add('hidden');
                document.getElementById('results-container').classList.remove('hidden');
                
                // Update score display
                const scorePercentage = Math.round((historyQuiz.score / historyQuiz.totalQuestions) * 100);
                document.getElementById('score-percentage').textContent = `${scorePercentage}%`;
                
                // Update circle progress
                const circumference = 2 * Math.PI * 54;
                const offset = circumference - (scorePercentage / 100) * circumference;
                document.querySelector('.score-circle-fill').style.strokeDasharray = circumference;
                document.querySelector('.score-circle-fill').style.strokeDashoffset = offset;
                
                // Update summary stats
                document.getElementById('correct-answers').textContent = historyQuiz.score;
                document.getElementById('incorrect-answers').textContent = '?'; // We don't have this info in history
                document.getElementById('unanswered').textContent = '?'; // We don't have this info in history
                
                // Format time spent
                const timeTaken = historyQuiz.timeTaken || 0;
                const minutes = Math.floor(timeTaken / 60000);
                const seconds = Math.floor((timeTaken % 60000) / 1000);
                document.getElementById('time-spent').textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                // Hide review section as we don't have detailed data
                document.getElementById('review-container').classList.add('hidden');
                document.getElementById('review-answers').classList.add('hidden');
            } catch (error) {
                console.error('Error viewing quiz history:', error);
                alert(`Failed to load quiz history: ${error.message}`);
            }
        }
        
        /**
         * Retry a quiz with similar settings to a historical quiz
         * @param {number} quizId - The index of the quiz in history
         */
        async retryQuiz(quizId) {
            try {
                // Show loading state
                document.getElementById('hero').classList.add('hidden');
                document.getElementById('quiz-settings').classList.add('hidden');
                document.getElementById('results-container').classList.add('hidden');
                document.getElementById('quiz-container').classList.remove('hidden');
                
                document.getElementById('question-container').innerHTML = `
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Generating a similar quiz with Gemini AI...</p>
                    </div>
                `;
                
                // Generate similar quiz
                const quiz = await this.quizGenerator.retrySimilarQuiz(quizId);
                
                // Update UI with first question
                this.updateQuizUI(quiz);
                
                // Start timer (default to 45 minutes)
                this.startTimer(45);
                
                // Enable navigation
                document.getElementById('next-question').disabled = false;
            } catch (error) {
                console.error('Error retrying quiz:', error);
                alert(`Failed to generate similar quiz: ${error.message}`);
                
                // Go back to home screen
                document.getElementById('quiz-container').classList.add('hidden');
                document.getElementById('hero').classList.remove('hidden');
            }
        }
    }