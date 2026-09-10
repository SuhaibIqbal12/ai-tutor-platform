import { genAI, GEMINI_MODEL } from '../config/gemini';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { SchemaType } from '@google/generative-ai';

export class QuizService {
  /**
   * Generates a multiple-choice quiz using Gemini's structured output mode.
   */
  public async generateQuiz(userId: string, topic: string, questionCount = 5): Promise<any> {
    if (!topic) {
      throw new AppError('Topic is required for quiz generation.', 400);
    }

    try {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              questions: {
                type: SchemaType.ARRAY,
                description: 'List of multiple choice quiz questions',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    question: { type: SchemaType.STRING, description: 'The question text' },
                    options: {
                      type: SchemaType.ARRAY,
                      description: 'Exactly 4 multiple choice options',
                      items: { type: SchemaType.STRING }
                    },
                    correctAnswerIndex: { type: SchemaType.INTEGER, description: 'Zero-based index of the correct answer (0 to 3)' },
                    explanation: { type: SchemaType.STRING, description: 'Detailed explanation of why this answer is correct' }
                  },
                  required: ['question', 'options', 'correctAnswerIndex', 'explanation']
                }
              }
            },
            required: ['questions']
          }
        }
      });

      const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
      const currentLevel = userProfile?.currentLevel || 'Intermediate';
      const learningStyle = userProfile?.learningStyle || 'Mixed';

      const prompt = `Generate an adaptive quiz about the topic: "${topic}". The quiz must contain exactly ${questionCount} multiple choice questions.
The student is currently at a "${currentLevel}" level and prefers a "${learningStyle}" learning style.
If the student is Beginner, make the questions conceptual and easy. If Advanced, make them highly technical and complex.
Each question must have exactly 4 choices.`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Parse the JSON output safely
      const parsedData = JSON.parse(text);
      if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
        throw new Error('Invalid quiz format returned by Gemini.');
      }

      // Save generated quiz to database
      const quiz = await prisma.quiz.create({
        data: {
          userId,
          topic,
          questions: JSON.stringify(parsedData.questions),
        },
      });

      return {
        quizId: quiz.id,
        topic: quiz.topic,
        questions: parsedData.questions,
      };
    } catch (error: any) {
      console.error('Quiz Generation Error:', error);
      if (error.message && error.message.includes('API key not valid')) {
        throw new AppError('Gemini API Key is invalid, expired, or missing. Please verify the GEMINI_API_KEY in your .env file.', 401);
      }
      throw new AppError(`Failed to generate quiz: ${error.message || error}`, 502);
    }
  }

  /**
   * Submits student answers, scores the quiz, and stores the attempt record.
   */
  public async submitQuizAttempt(userId: string, quizId: string, answers: number[]): Promise<any> {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new AppError('Quiz not found.', 404);
    }

    const quizQuestions = JSON.parse(quiz.questions) as any[];

    if (answers.length !== quizQuestions.length) {
      throw new AppError(`Incorrect number of answers. Expected ${quizQuestions.length}, got ${answers.length}.`, 400);
    }

    // Grade attempt
    let score = 0;
    const gradedQuestions = quizQuestions.map((q, idx) => {
      const studentAnswer = answers[idx];
      const isCorrect = studentAnswer === q.correctAnswerIndex;
      if (isCorrect) score++;

      return {
        ...q,
        studentAnswer,
        isCorrect,
      };
    });

    // Phase 2: Spaced Repetition & Topic Mastery
    const percentage = score / quizQuestions.length;
    const masteryStatus = percentage >= 0.8 ? "STRONG" : (percentage >= 0.5 ? "MODERATE" : "WEAK");
    
    const existingMastery = await prisma.topicMastery.findUnique({
      where: { userId_topic: { userId, topic: quiz.topic } }
    });

    let newInterval = 1;
    if (existingMastery) {
      if (percentage >= 0.8) {
        newInterval = Math.max(1, Math.round(existingMastery.spacedRepetitionInterval * 2.5));
      } else if (percentage >= 0.5) {
        newInterval = Math.max(1, existingMastery.spacedRepetitionInterval);
      } else {
        newInterval = 1; // Reset
      }
    }
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

    await prisma.topicMastery.upsert({
      where: { userId_topic: { userId, topic: quiz.topic } },
      create: {
        userId,
        topic: quiz.topic,
        status: masteryStatus,
        correctCount: score,
        incorrectCount: quizQuestions.length - score,
        spacedRepetitionInterval: newInterval,
        nextReviewDate,
        lastTested: new Date()
      },
      update: {
        status: masteryStatus,
        correctCount: { increment: score },
        incorrectCount: { increment: quizQuestions.length - score },
        spacedRepetitionInterval: newInterval,
        nextReviewDate,
        lastTested: new Date()
      }
    });

    // Save attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        score,
        totalCount: quizQuestions.length,
        answers: JSON.stringify(answers),
      },
    });

    return {
      attemptId: attempt.id,
      score,
      totalCount: quizQuestions.length,
      percentage: Math.round((score / quizQuestions.length) * 100),
      gradedQuestions,
      createdAt: attempt.createdAt,
    };
  }

  /**
   * Retrieves previous attempts for a user.
   */
  public async getHistory(userId: string): Promise<any[]> {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId },
      include: {
        quiz: {
          select: {
            topic: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return attempts.map(attempt => ({
      attemptId: attempt.id,
      quizId: attempt.quizId,
      topic: attempt.quiz.topic,
      score: attempt.score,
      totalCount: attempt.totalCount,
      percentage: Math.round((attempt.score / attempt.totalCount) * 100),
      createdAt: attempt.createdAt,
    }));
  }
}
