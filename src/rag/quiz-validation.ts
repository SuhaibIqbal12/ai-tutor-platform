export function normalizeAnswer(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
}
export function validateQuestions(questions: any[], expected: number): void {
  if (!Array.isArray(questions) || questions.length !== expected) throw new Error('Incorrect question count');
  const seen = new Set<string>();
  const types = ['mcq','tf','fitb','scenario','subjective','coding','debugging','output_pred','optimization'];
  for (const q of questions) {
    if (typeof q.question !== 'string' || !q.question.trim() || typeof q.explanation !== 'string' || !types.includes(q.type)) throw new Error('Invalid question');
    const key = normalizeAnswer(q.question); if (seen.has(key)) throw new Error('Duplicate question'); seen.add(key);
    if (['mcq','tf'].includes(q.type)) {
      const expectedOptions = q.type === 'mcq' ? 4 : 2;
      if (!Array.isArray(q.options) || q.options.length !== expectedOptions || !q.options.every((x: unknown) => typeof x === 'string' && x.trim()) || new Set(q.options.map(normalizeAnswer)).size !== expectedOptions || !Number.isInteger(q.correctAnswerIndex) || q.correctAnswerIndex < 0 || q.correctAnswerIndex >= expectedOptions) throw new Error('Invalid answer options');
    } else if (typeof q.correctAnswerText !== 'string' || !q.correctAnswerText.trim()) throw new Error('Missing model answer');
  }
}
export function publicQuestions(questions: any[]) {
  return questions.map(({ correctAnswerIndex, correctAnswerText, explanation, ...question }) => question);
}
