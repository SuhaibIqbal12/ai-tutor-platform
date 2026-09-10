import { genAI, GEMINI_MODEL } from '../config/gemini';
import { SchemaType } from '@google/generative-ai';
import { AppError } from '../middleware/error.middleware';

export class CodingAgent {
  /**
   * Generates a coding challenge with code templates and description.
   */
  public async generateCodingExercise(
    language: string,
    topic: string,
    difficulty: 'easy' | 'medium' | 'hard',
    studentProfile?: {
      currentLevel?: string;
      learningStyle?: string;
    }
  ): Promise<any> {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING, description: 'Markdown description of the coding task' },
            starterCode: { type: SchemaType.STRING, description: 'Initial code skeleton or template' },
            testCases: {
              type: SchemaType.ARRAY,
              description: 'List of sample test cases',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  input: { type: SchemaType.STRING },
                  expectedOutput: { type: SchemaType.STRING }
                },
                required: ['input', 'expectedOutput']
              }
            },
            hints: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Progressive hints to guide the user'
            }
          },
          required: ['title', 'description', 'starterCode', 'testCases', 'hints']
        }
      }
    });

    const prompt = `Generate a programming challenge in the ${language} language on the topic of "${topic}".
Difficulty Tier: ${difficulty}.
Student Learning Level: ${studentProfile?.currentLevel || 'Intermediate'}.
Student Learning Style: ${studentProfile?.learningStyle || 'Mixed'}.

Include starter boilerplate code, sample test cases, and a list of hints that help the student without giving away the direct solution. Tailor the instructions and hints to their learning level and style.`;

    try {
      const result = await model.generateContent(prompt);
      let text = result.response.text();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch (err: any) {
      console.error('Coding Agent Exercise Generation Error:', err);
      throw new AppError(`Failed to generate coding exercise: ${err.message || err}`, 502);
    }
  }

  /**
   * Reviews a student's code submission.
   */
  public async reviewCodeSubmission(
    language: string,
    problemTitle: string,
    description: string,
    studentCode: string,
    studentProfile?: {
      currentLevel?: string;
      learningStyle?: string;
    }
  ): Promise<any> {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isCorrect: { type: SchemaType.BOOLEAN },
            feedback: { type: SchemaType.STRING, description: 'Short review comment' },
            bugsFound: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'List of bugs, syntax errors, or logical flaws'
            },
            hints: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Hints on how to resolve the issues'
            },
            optimizedSolution: {
              type: SchemaType.STRING,
              description: 'An optimized, cleaner, and well-commented solution'
            },
            timeComplexity: { type: SchemaType.STRING, description: 'e.g. O(N log N)' },
            spaceComplexity: { type: SchemaType.STRING, description: 'e.g. O(1)' }
          },
          required: ['isCorrect', 'feedback', 'bugsFound', 'hints', 'optimizedSolution', 'timeComplexity', 'spaceComplexity']
        }
      }
    });

    const prompt = `Review the following student code submission:
Language: ${language}
Problem Title: ${problemTitle}
Problem Description: ${description}
Student's Code:
\`\`\`${language}
${studentCode}
\`\`\`

Student Learning Level: ${studentProfile?.currentLevel || 'Intermediate'}
Student Learning Style: ${studentProfile?.learningStyle || 'Mixed'}

Analyze the code for syntactic correctness, logical errors, time/space complexity, and best practices. Respond strictly in the JSON schema format.
Tailor the feedback and hints to the student's level and style (e.g. more structural explanations for Analogy-driven, runnable step-by-step pointers for Practical, simplified concepts for Beginners).`;

    try {
      const result = await model.generateContent(prompt);
      let text = result.response.text();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch (err: any) {
      console.error('Coding Agent Code Review Error:', err);
      throw new AppError(`Failed to review code: ${err.message || err}`, 502);
    }
  }
}
