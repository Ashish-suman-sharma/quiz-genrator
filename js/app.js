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

    // Load progress data on startup
    loadProgressAnalysis();

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
     * Load and display quiz progress analysis using chart.js
     */
    function loadProgressAnalysis() {
        const quizzes = storage.getQuizHistory();
        const progressChart = document.getElementById('progress-chart');
        
        // Take only the last 20 quizzes, but reverse to show oldest to newest
        const recentQuizzes = quizzes.slice(0, 20).reverse();
        
        if (recentQuizzes.length === 0) {
            // Show empty state
            document.getElementById('avg-score').textContent = '0%';
            document.getElementById('score-trend').textContent = '-';
            document.getElementById('completed-quizzes').textContent = '0';
            document.getElementById('highest-score').textContent = '0%';
            
            // Empty chart with a message
            new Chart(progressChart, {
                type: 'line',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        label: 'Quiz Scores',
                        data: [],
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                        backgroundColor: 'rgba(67, 97, 238, 0.1)',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Complete your first quiz to see progress',
                            font: {
                                size: 16
                            }
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Score Percentage'
                            }
                        }
                    }
                }
            });
            return;
        }
        
        // Calculate metrics
        const scores = recentQuizzes.map(q => Math.round((q.score / q.totalQuestions) * 100));
        const avgScore = scores.reduce((acc, score) => acc + score, 0) / scores.length;
        const highestScore = Math.max(...scores);
        
        // Determine trend (last 3 quizzes)
        let trendElement = document.getElementById('score-trend');
        if (scores.length >= 3) {
            const lastThreeScores = scores.slice(-3);
            if (lastThreeScores[2] > lastThreeScores[0]) {
                trendElement.textContent = 'Improving';
                trendElement.classList.add('up');
            } else if (lastThreeScores[2] < lastThreeScores[0]) {
                trendElement.textContent = 'Declining';
                trendElement.classList.add('down');
            } else {
                trendElement.textContent = 'Steady';
                trendElement.classList.add('steady');
            }
        } else {
            trendElement.textContent = 'Insufficient Data';
        }
        
        // Update metrics
        document.getElementById('avg-score').textContent = `${Math.round(avgScore)}%`;
        document.getElementById('completed-quizzes').textContent = recentQuizzes.length;
        document.getElementById('highest-score').textContent = `${highestScore}%`;
        
        // Create labels for attempts (Attempt 1, Attempt 2, etc.)
        const labels = recentQuizzes.map((_, index) => `Attempt ${index + 1}`);
        
        // Create the chart
        new Chart(progressChart, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Quiz Score',
                    data: scores,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: 'white',
                    pointBorderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const quizIndex = context.dataIndex;
                                const quiz = recentQuizzes[quizIndex];
                                return [
                                    `Score: ${quiz.score}/${quiz.totalQuestions}`,
                                    `Topics: ${quiz.topics.join(', ')}`
                                ];
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Score Percentage'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Attempts'
                        }
                    }
                }
            }
        });
    }

    // Initialize the application
    loadTheme();
});