class GeminiAPI {
    constructor() {
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        this.isConfigured = false;
    }

    loadSavedApiKey() {
        const savedApiKey = localStorage.getItem('geminiApiKey');
        if (savedApiKey) {
            this.apiKey = savedApiKey;
            this.isConfigured = true;
            return true;
        }
        return false;
    }

    configure(apiKey) {
        this.apiKey = apiKey;
        this.isConfigured = true;
        localStorage.setItem('geminiApiKey', apiKey);
    }

    // ...existing code...

    async generateQuiz(settings) {
        if (!this.isConfigured) {
            throw new Error('Gemini API key not configured');
        }

        const { topics, questionTypes, numberOfQuestions = 25 } = settings;
        
        // Create a detailed prompt for the Gemini API
        const prompt = {
            contents: [
                {
                    parts: [
                        {
                            text: `Generate ${numberOfQuestions} interview questions for a technical software engineering interview quiz, with the following characteristics:
                            
Topics: ${topics.join(', ')}
Question Types: ${questionTypes.join(', ')}

For each question, provide:
1. A unique ID (number from 1 to ${numberOfQuestions})
2. The question type (one of: ${questionTypes.join(', ')})
3. The topic (one of: ${topics.join(', ')})
4. The question text
5. For MCQs: 4 options with letters (A, B, C, D) and only one correct answer
6. For coding questions: a skeleton code, expected output, and test cases
7. For theory questions: key points that should be included in the answer

For all questions, include an explanation of the answer.

Return the response as a valid JSON object with this structure:
{
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "topic": "dsa",
      "question": "What is the time complexity of...",
      "options": [
        {"letter": "A", "text": "O(1)"},
        {"letter": "B", "text": "O(n)"},
        {"letter": "C", "text": "O(log n)"},
        {"letter": "D", "text": "O(n²)"}
      ],
      "correctAnswer": "B",
      "explanation": "The time complexity is O(n) because..."
    },
    {
      "id": 2,
      "type": "coding",
      "topic": "javascript",
      "question": "Write a function that...",
      "starterCode": "function solution(arr) {\n  // Your code here\n}",
      "sampleCases": [
        {"input": "[1, 2, 3]", "output": "6"}
      ],
      "explanation": "This question tests knowledge of..."
    }
    // More questions...
  ]
}`
                        }
                    ]
                }
            ]
        };

        try {
            const url = `${this.baseUrl}?key=${this.apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(prompt)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const responseText = data.candidates[0].content.parts[0].text;
            
            // Extract JSON object from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse quiz questions from API response');
            }
            
            const questions = JSON.parse(jsonMatch[0]).questions;
            return questions;
        } catch (error) {
            console.error('Error generating quiz:', error);
            throw error;
        }
    }

    // ...existing code...

    async evaluateAnswer(questionData, userAnswer) {
        if (!this.isConfigured) {
            throw new Error('Gemini API key not configured');
        }
        
        // Different evaluation approaches based on question type
        if (questionData.type === 'mcq') {
            // For MCQs, we can evaluate on the client side
            const isCorrect = userAnswer === questionData.correctAnswer;
            return {
                correct: isCorrect,
                explanation: questionData.explanation,
                score: isCorrect ? 1 : 0
            };
        } else {
            // For coding and theory questions, use the API
            const prompt = {
                contents: [
                    {
                        parts: [
                            {
                                text: `Evaluate the following ${questionData.type} answer for a technical interview question.

Question: ${questionData.question}

${questionData.type === 'coding' ? 
`Sample Test Cases:
${JSON.stringify(questionData.sampleCases)}

User's Solution:
\`\`\`
${userAnswer}
\`\`\`` :

`Expected Key Points:
${questionData.keyPoints ? questionData.keyPoints.join(', ') : 'Not provided'}

User's Answer:
${userAnswer}`}

Evaluate the answer and provide:
1. Is it correct? (true/false)
2. Score (0-1, with 1 being perfect)
3. A detailed explanation of what is correct and what could be improved
4. For coding questions, check if the solution works for the test cases and has good time/space complexity

Return the response as a JSON object with this structure:
{
  "correct": true/false,
  "score": 0.8,
  "explanation": "The answer is mostly correct, but..."
}`
                            }
                        ]
                    }
                ]
            };

            try {
                const url = `${this.baseUrl}?key=${this.apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(prompt)
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }

                const data = await response.json();
                const responseText = data.candidates[0].content.parts[0].text;
                
                // Extract JSON object from response
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('Could not parse evaluation from API response');
                }
                
                return JSON.parse(jsonMatch[0]);
            } catch (error) {
                console.error('Error evaluating answer:', error);
                // Fallback to a manual review message if API fails
                return {
                    correct: null, // null indicates manual review needed
                    score: 0,
                    explanation: "We couldn't automatically evaluate this answer. Please compare with the explanation."
                };
            }
        }
    }

    isApiConfigured() {
        return this.isConfigured;
    }
}
