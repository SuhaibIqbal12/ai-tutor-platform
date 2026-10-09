export interface Roadmap { title: string; roadmapStages: { stageName: string; description: string; recommendedSkills: string[] }[] }
export interface ResumeAnalysis { atsScore: number; feedback: string; improvements: string[]; missingKeywords: string[] }
export interface Scorecard { grade: string; overallScore: number; overallComment: string; strengths: string[]; improvements: string[]; answerBreakdown: { question: string; answer: string; score: number; comment: string }[]; technicalAccuracy: number; communication: number; problemSolving: number; confidence: number; clarity: number; depth: number }
export interface Challenge { title: string; question: string; options: string[]; correctAnswerIndex?: number; explanation: string; systemDesignRubric: string[] }
export interface Exercise { title: string; description: string; starterCode?: string; template?: string; hints: string[]; testCases: { input: string; expectedOutput: string }[] }
export interface CodeReview { isCorrect: boolean; feedback: string; bugsFound: string[]; optimizedSolution: string; timeComplexity: string; spaceComplexity: string }
export interface StudyPlan { title: string; examDate?: string; dailyPlan: { task: string; durationMinutes: number }[]; weeklyPlan: { week: string; focus: string; tasks: string[] }[]; monthlyPlan: string[] }
export interface Health { currentProvider: string; providers: Record<string, boolean>; database: string; redis: string; documentCount: number; chunkCount: number; nodeCount: number; latency: number }
export interface DiagnosticLog { type: string; timestamp: string; message: string; details?: Record<string, unknown> }
export interface Heatmap { categories: { strong: string[]; moderate: string[]; weak: string[] }; rawList: { topic: string; status: string }[] }
export interface QuizHistory { id: string; topic: string; score: number; totalCount: number; percentage: number; createdAt: string }
export interface GradedQuestion { question: string; type: string; difficulty: string; options?: string[]; studentAnswer: string | number; isCorrect: boolean; feedback: string; explanation: string }
export interface QuizReport { score: number; totalCount: number; percentage: number; gradedQuestions: GradedQuestion[] }
export interface GraphNode { id: string; label: string; type: string; description: string; documentTitle: string; documentId: string }
export interface GraphEdge { from: string; to: string; relation: string }
export interface DocumentProgress { status?: string; stage?: string; textExtracted?: boolean; chunksCount?: number; chunksCreated?: boolean; embeddingsCount?: number; embeddingsGenerated?: boolean; graphNodesCount?: number; graphGenerated?: boolean; flashcardsGenerated?: boolean; tutorReady?: boolean }
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Request failed. Please retry.'; }
