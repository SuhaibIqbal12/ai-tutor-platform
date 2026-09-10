import { genAI, GEMINI_MODEL } from '../config/gemini';
import { prisma } from '../config/prisma';
import { SchemaType } from '@google/generative-ai';
import { AppError } from '../middleware/error.middleware';

export class QuizAgent {
  /**
   * Generates a structured quiz containing exactly:
   * - 3 Easy questions
   * - 3 Medium questions
   * - 2 Hard questions
   * Supporting MCQs, True/False, Fill in the Blanks, Scenario-based, Subjective, and Coding.
   */
  public async generateQuiz(userId: string, topic: string, isCodingTopic = false): Promise<any> {
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
                description: 'List of quiz questions. Must contain exactly 8 questions: 3 easy, 3 medium, 2 hard.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    question: { type: SchemaType.STRING, description: 'The question text' },
                    type: {
                      type: SchemaType.STRING,
                      description: 'Type of question: mcq, tf, fitb, scenario, subjective, coding, debugging, output_pred, optimization'
                    },
                    difficulty: {
                      type: SchemaType.STRING,
                      description: 'Difficulty tier: easy, medium, hard'
                    },
                    options: {
                      type: SchemaType.ARRAY,
                      description: 'List of options. For mcq: exactly 4 choices. For tf: exactly 2 choices (True, False). For fitb/subjective/coding: leave empty or omit.',
                      items: { type: SchemaType.STRING }
                    },
                    correctAnswerIndex: {
                      type: SchemaType.INTEGER,
                      description: 'Zero-based index of the correct answer (for mcq/tf). Leave -1 if not applicable.'
                    },
                    correctAnswerText: {
                      type: SchemaType.STRING,
                      description: 'The correct word, code, or explanation (for fitb, coding, debugging, or subjective questions).'
                    },
                    explanation: {
                      type: SchemaType.STRING,
                      description: 'Detailed explanation of the solution and reasoning.'
                    },
                    codingTemplate: {
                      type: SchemaType.STRING,
                      description: 'Starter code or faulty code snippet for coding/debugging challenges. Leave blank if not coding.'
                    }
                  },
                  required: ['question', 'type', 'difficulty', 'explanation']
                }
              }
            },
            required: ['questions']
          }
        }
      });

      const codingInstructions = isCodingTopic
        ? `Since this is a programming topic, include coding challenges (e.g. write a function), debugging challenges (e.g. fix this bug), output prediction challenges, or code optimization challenges.`
        : `Include standard conceptual questions, fill in the blank items, true/false statements, and scenario-based word problems.`;

      const prompt = `Generate an adaptive quiz on the topic: "${topic}".
The quiz MUST have exactly 8 questions distributed as follows:
- 3 Easy questions
- 3 Medium questions
- 2 Hard questions

${codingInstructions}

Ensure all questions are educational, clear, and challenging. Ensure options arrays are populated for mcq (4 options) and tf (2 options) questions.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
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
      console.error('Quiz Agent Generation Error:', error);
      throw new AppError(`Failed to generate structured quiz: ${error.message || error}`, 502);
    }
  }

  /**
   * Scores and returns feedback for subjective and objective questions.
   */
  public async submitQuizAttempt(userId: string, quizId: string, answers: any[]): Promise<any> {
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

    let score = 0;
    const gradedQuestions = [];

    for (let idx = 0; idx < quizQuestions.length; idx++) {
      const q = quizQuestions[idx];
      const studentAnswer = answers[idx];
      let isCorrect = false;

      if (q.type === 'mcq' || q.type === 'tf') {
        const studentIndex = typeof studentAnswer === 'number' ? studentAnswer : parseInt(studentAnswer, 10);
        isCorrect = studentIndex === q.correctAnswerIndex;
        if (isCorrect) score++;
        gradedQuestions.push({
          ...q,
          studentAnswer,
          isCorrect,
          feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer was: ${q.options[q.correctAnswerIndex]}`
        });
      } else {
        // Evaluate subjective, coding, debugging, or FITB answer using Gemini
        const evaluationModel = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                isCorrect: { type: SchemaType.BOOLEAN },
                feedback: { type: SchemaType.STRING, description: 'Direct feedback to the student' }
              },
              required: ['isCorrect', 'feedback']
            }
          }
        });

        const prompt = `Evaluate the student's answer for the following question:
Question: ${q.question}
Question Type: ${q.type}
Expected/Sample Answer: ${q.correctAnswerText || 'N/A'}
Student's Answer: ${String(studentAnswer)}

Determine if the answer is conceptually correct and provide a short constructive feedback.`;

        try {
          const evalResult = await evaluationModel.generateContent(prompt);
          const evalJson = JSON.parse(evalResult.response.text());
          isCorrect = evalJson.isCorrect;
          if (isCorrect) score++;
          gradedQuestions.push({
            ...q,
            studentAnswer,
            isCorrect,
            feedback: evalJson.feedback
          });
        } catch (err) {
          console.error('Subjective Eval Error:', err);
          gradedQuestions.push({
            ...q,
            studentAnswer,
            isCorrect: false,
            feedback: 'Unable to evaluate subjective answer due to API issues. Marked as incorrect.'
          });
        }
      }

      // Update Topic Mastery in database based on performance
      await this.updateTopicMastery(userId, quiz.topic, isCorrect);
    }

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

    // Recalculate Learning DNA in background
    const { LearningDnaService } = require('../services/dna.service');
    LearningDnaService.recalculateDNA(userId).catch((err: any) => console.error(err));

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
   * Dynamically logs correct and incorrect answers to update the student's Topic Mastery.
   */
  private async updateTopicMastery(userId: string, topic: string, isCorrect: boolean): Promise<void> {
    const topicMastery = await prisma.topicMastery.findUnique({
      where: {
        userId_topic: {
          userId,
          topic
        }
      }
    });

    if (topicMastery) {
      const correctCount = topicMastery.correctCount + (isCorrect ? 1 : 0);
      const incorrectCount = topicMastery.incorrectCount + (isCorrect ? 0 : 1);
      const total = correctCount + incorrectCount;
      const successRate = correctCount / total;

      let status = 'MODERATE';
      if (successRate >= 0.75) status = 'STRONG';
      else if (successRate < 0.40) status = 'WEAK';

      await prisma.topicMastery.update({
        where: { id: topicMastery.id },
        data: {
          correctCount,
          incorrectCount,
          status,
          lastTested: new Date()
        }
      });
    } else {
      await prisma.topicMastery.create({
        data: {
          userId,
          topic,
          status: isCorrect ? 'STRONG' : 'WEAK',
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          lastTested: new Date()
        }
      });
    }
  }
}
