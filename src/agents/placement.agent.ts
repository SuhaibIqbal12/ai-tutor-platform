import { genAI, GEMINI_MODEL } from '../config/gemini';
import { SchemaType } from '@google/generative-ai';
import { AppError } from '../middleware/error.middleware';

export interface InterviewMessage {
  role: 'interviewer' | 'student';
  text: string;
}

export class PlacementAgent {
  /**
   * Evaluates a resume text for ATS compatibility and returns a score and suggestions.
   */
  public async analyzeResume(resumeText: string, jobTitle = 'Software Engineer'): Promise<any> {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            atsScore: { type: SchemaType.INTEGER, description: 'ATS score from 0 to 100' },
            feedback: { type: SchemaType.STRING, description: 'Overall feedback' },
            improvements: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Actionable items to improve the score'
            },
            skillsIdentified: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            missingKeywords: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Recommended industry keywords to add'
            }
          },
          required: ['atsScore', 'feedback', 'improvements', 'skillsIdentified', 'missingKeywords']
        }
      }
    });

    const prompt = `Analyze the following resume text for a target role of "${jobTitle}".
Compute an ATS score (0-100), identify skills present, list key missing keywords, and suggest improvements.

=== RESUME TEXT ===
${resumeText}
===================`;

    try {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (err: any) {
      console.error('Placement Agent Resume Analysis Error:', err);
      throw new AppError(`Failed to parse resume: ${err.message || err}`, 502);
    }
  }

  /**
   * Conducts the next step of a simulated Mock Interview.
   */
  public async getMockInterviewResponse(
    role: 'Technical' | 'HR',
    history: InterviewMessage[],
    studentAnswer?: string
  ): Promise<{ interviewerMessage: string; feedback?: string; endSession: boolean; scorecard?: any }> {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            interviewerMessage: { type: SchemaType.STRING, description: 'Next question or closing message from the interviewer' },
            feedback: { type: SchemaType.STRING, description: 'Constructive review of the student last answer. Leave blank if it is the first greeting.' },
            endSession: { type: SchemaType.BOOLEAN, description: 'True if the interview has reached a natural end (typically 4-5 questions)' }
          },
          required: ['interviewerMessage', 'endSession']
        }
      }
    });

    const formattedHistory = history.map(h => `${h.role === 'interviewer' ? 'Interviewer' : 'Student'}: ${h.text}`).join('\n');

    const prompt = `You are conducting a Mock ${role} Interview.
Your goal is to evaluate the candidate's thinking process, logic, and conceptual understanding rather than requiring strict word-for-word matching or memorized definitions.

Evaluation & Persona Rules:
1. DO NOT do strict line-by-line or exact keyword matching.
2. If the candidate's response is approximately 60%+ conceptually related to the question or demonstrates reasonable technical/logical intent, consider it a valid, solid answer.
3. Focus on understanding their thought process. Acknowledge what they got right, and ask follow-up questions to probe deeper or clarify their ideas.
4. Keep the conversation dynamic and interactive — ask relevant back-questions based on what they just explained.
5. Only provide corrective critique if their answer is completely off-target or logically incorrect.

Here is the conversation history so far:
${formattedHistory}

Student's Latest Input: "${studentAnswer || 'Greeting the interviewer'}"

Generate the next question/follow-up. Provide constructive feedback on their last response (if applicable). Set endSession to true after 4-5 rounds of questions. When endSession is true, interviewerMessage should be a warm, professional closing statement (NOT a question).`;

    try {
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());

      // If session is ending, generate a full scorecard
      if (parsed.endSession) {
        const scorecard = await this.generateInterviewScorecard(role, history, studentAnswer);
        return { ...parsed, scorecard };
      }

      return parsed;
    } catch (err: any) {
      console.error('Placement Agent Interview Error:', err);
      throw new AppError(`Failed to run mock interview: ${err.message || err}`, 502);
    }
  }

  /**
   * Generates a comprehensive scorecard after an interview session ends.
   */
  public async generateInterviewScorecard(
    role: 'Technical' | 'HR',
    history: InterviewMessage[],
    lastAnswer?: string
  ): Promise<any> {
    const scorecardModel = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            overallScore: { type: SchemaType.INTEGER, description: 'Overall interview performance score from 0 to 10' },
            grade: { type: SchemaType.STRING, description: 'Letter grade: A+, A, B+, B, C+, C, D, or F' },
            overallComment: { type: SchemaType.STRING, description: 'Detailed overall coach commentary on the candidate performance, tone, depth, and areas to work on. 3-4 sentences.' },
            strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '2-3 specific strengths shown during this session' },
            improvements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '2-3 specific areas to improve for next time' },
            answerBreakdown: {
              type: SchemaType.ARRAY,
              description: 'Per-answer evaluation for each student response in the session',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  question: { type: SchemaType.STRING, description: 'The interviewer question that was asked' },
                  answer: { type: SchemaType.STRING, description: 'The student answer (summarized if long)' },
                  score: { type: SchemaType.INTEGER, description: 'Score for this answer out of 10' },
                  comment: { type: SchemaType.STRING, description: 'Specific feedback on this answer - what was good, what was missing' }
                },
                required: ['question', 'answer', 'score', 'comment']
              }
            }
          },
          required: ['overallScore', 'grade', 'overallComment', 'strengths', 'improvements', 'answerBreakdown']
        }
      }
    });

    // Build a clean Q&A view from history
    const qaList: string[] = [];
    for (let i = 0; i < history.length; i++) {
      if (history[i].role === 'interviewer' && history[i + 1]?.role === 'student') {
        qaList.push(`Q: ${history[i].text}\nA: ${history[i + 1].text}`);
      }
    }
    if (lastAnswer) {
      const lastQ = [...history].reverse().find(h => h.role === 'interviewer');
      if (lastQ) qaList.push(`Q: ${lastQ.text}\nA: ${lastAnswer}`);
    }

    const prompt = `You are an expert ${role} interview coach evaluating a mock interview session.

Evaluation Principles:
- DO NOT perform strict line-by-line or exact keyword matching.
- Focus on candidate's underlying logic, problem-solving intent, and thought process.
- If a candidate's answer is ~60%+ conceptually relevant or demonstrates solid core understanding, consider it a strong, valid answer and score it generously (7-10/10).
- Give credit for clear communication and logical reasoning, even if specific framework/library buzzwords were not explicitly stated.

Interview Type: ${role}
Session Q&A:
${qaList.join('\n\n')}

Evaluate each answer fairly. Score each answer out of 10 based on conceptual relevance, thinking process, and clarity. Compute an overall score out of 10. Assign a grade:
- A+ (9-10): Outstanding conceptual grasp and communication
- A  (8-8.9): Excellent understanding and clear logic
- B+ (7-7.9): Good conceptual relevance (~60-80% match) with solid reasoning
- B  (6-6.9): Fair understanding with minor gaps
- C+ (5-5.9): Average attempt, partial relevance
- C  (4-4.9): Below Average, significant gaps
- D  (3-3.9): Poor alignment with question
- F  (0-2.9): Unresponsive or completely off-topic

Be encouraging, specific, and constructive.`;

    try {
      const result = await scorecardModel.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (err: any) {
      console.error('Scorecard Generation Error:', err);
      // Return a fallback scorecard if generation fails
      return {
        overallScore: 5,
        grade: 'C+',
        overallComment: 'Interview session completed. Detailed scoring unavailable — please try again.',
        strengths: ['Completed the interview session'],
        improvements: ['Practice more mock interviews to improve'],
        answerBreakdown: []
      };
    }
  }

  /**
   * Generates placement practice questions (Aptitude, SQL, or System Design).
   */
  public async generatePlacementPractice(type: 'aptitude' | 'sql' | 'system_design'): Promise<any> {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            question: { type: SchemaType.STRING },
            options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'For aptitude/sql MCQ options. Leave empty for system design.' },
            correctAnswerIndex: { type: SchemaType.INTEGER, description: 'For MCQ. Leave -1 if subjective.' },
            explanation: { type: SchemaType.STRING },
            systemDesignRubric: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Key components to cover in a correct system design answer.' }
          },
          required: ['title', 'question', 'explanation']
        }
      }
    });

    const prompt = `Generate a challenging placement practice challenge of type: ${type}.
- For SQL: Focus on joins, aggregates, or window functions.
- For Aptitude: Focus on quantitative, logic, or algorithmic puzzles.
- For System Design: Focus on microservices, scaling, load balancing, or databases.`;

    try {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (err: any) {
      console.error('Placement Agent Practice Generation Error:', err);
      throw new AppError(`Failed to generate practice challenge: ${err.message || err}`, 502);
    }
  }
}
