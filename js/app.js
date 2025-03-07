/**
 * Main application file for InterviewPrep AI Quiz Generator
 * Initializes the app and coordinates between different modules
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize AOS animation library
    AOS.init({
        duration: 800,
        easing: 'ease-in-out',
        once: true,
        offset: 100
    });

    // Initialize modules
    const storage = new StorageManager();
    const geminiApi = new GeminiAPI();
    const quizGenerator = new QuizGenerator(geminiApi, storage);
    const quizUI = new QuizUI(quizGenerator, storage);

    // Initialize the UI components
    quizUI.init();

    // Load quiz history on startup
    loadQuizHistory();

    // Theme toggling
    const themeToggle = document.querySelector('.theme-toggle');
    themeToggle.addEventListener('click', toggleTheme);

    // Event delegation for navigation links
    document.querySelector('.nav-links').addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
            document.querySelectorAll('.nav-links a').forEach(link => {
                link.classList.remove('active');
            });
            e.target.classList.add('active');
        }
    });

    /**
     * Toggle between light and dark theme
     */
    function toggleTheme() {
        const body = document.body;
        const icon = document.querySelector('.theme-toggle i');
        
        body.classList.toggle('dark-mode');
        
        if (body.classList.contains('dark-mode')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            localStorage.setItem('theme', 'light');
        }
    }

    /**
     * Load user's preferred theme from localStorage
     */
    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        const icon = document.querySelector('.theme-toggle i');
        
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }

    /**
     * Load and display quiz history from local storage
     */
    function loadQuizHistory() {
        const historyContainer = document.getElementById('history-container');
        const quizzes = storage.getQuizHistory();
        
        if (quizzes.length === 0) {
            return; // Default "empty history" message is already in the HTML
        }
        
        // Clear the empty history message
        historyContainer.innerHTML = '';
        
        // Add each quiz to the history section
        quizzes.forEach((quiz, index) => {
            const date = new Date(quiz.date);
            const formattedDate = date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const scorePercentage = Math.round((quiz.score / quiz.totalQuestions) * 100);
            
            const historyCard = document.createElement('div');
            historyCard.className = 'history-card';
            
            let topicsHtml = '';
            quiz.topics.forEach(topic => {
                topicsHtml += `<span class="history-topic">${formatTopicName(topic)}</span>`;
            });
            
            historyCard.innerHTML = `
                <div class="history-date">${formattedDate}</div>
                <div class="history-score">${scorePercentage}%</div>
                <div>Score: ${quiz.score}/${quiz.totalQuestions}</div>
                <div class="history-topics">
                    ${topicsHtml}
                </div>
                <div class="history-actions">
                    <button class="btn-secondary view-quiz" data-quiz-id="${index}">View</button>
                    <button class="btn-primary retry-quiz" data-quiz-id="${index}">Retry Similar</button>
                </div>
            `;
            
            historyContainer.appendChild(historyCard);
        });
        
        // Add event listeners to the new buttons
        document.querySelectorAll('.view-quiz').forEach(btn => {
            btn.addEventListener('click', e => {
                const quizId = e.target.dataset.quizId;
                quizUI.viewQuizFromHistory(quizId);
            });
        });
        
        document.querySelectorAll('.retry-quiz').forEach(btn => {
            btn.addEventListener('click', e => {
                const quizId = e.target.dataset.quizId;
                quizUI.retryQuiz(quizId);
            });
        });
    }

    /**
     * Format topic name for display
     * @param {string} topic - The topic identifier
     * @returns {string} - Formatted topic name
     */
    function formatTopicName(topic) {
        const topicMap = {
            'dsa': 'DSA',
            'javascript': 'JavaScript',
            'web': 'Web Dev',
            'react': 'React',
            'network': 'Networks',
            'http': 'HTTP/HTTPS'
        };
        
        return topicMap[topic] || topic.charAt(0).toUpperCase() + topic.slice(1);
    }

    // Initialize the application
    loadTheme();
});