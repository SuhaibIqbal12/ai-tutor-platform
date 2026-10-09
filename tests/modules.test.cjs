const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startDatabase } = require('./database.cjs');
let database, prisma, listener, origin, token, userId, provider, originalModel;
let responseValue, providerFailure = false;
const payloads = {
  '/api/coding/exercise': { language: 'python', topic: 'arrays', difficulty: 'easy' },
  '/api/coding/review': { language: 'python', problemTitle: 'Sum', description: 'Return the sum.', studentCode: 'def add(a, b):\n    return a + b' },
  '/api/placement/resume': { resumeText: 'Built a Python application with PostgreSQL and documented its tests.', targetRole: 'Backend Engineer' },
  '/api/placement/interview': { type: 'Technical', history: [], studentAnswer: 'Hello, I work with Python.' },
  '/api/planner/generate': { examDate: '2099-12-31', availableHours: '2', academicGoal: 'Learn algorithms' },
};
async function request(path, value, auth = true) {
  const res = await fetch(origin + path, { method: value === undefined ? 'GET' : 'POST', headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  return { status: res.status, data: await res.json() };
}
before(async () => {
  database = await startDatabase(); prisma = require('../dist/config/prisma').prisma;
  provider = require('../dist/services/ai-provider.service').aiProviderService;
  originalModel = provider.getModel;
  provider.getModel = () => ({ generateContent: async () => {
    if (providerFailure) throw Error('simulated provider outage');
    return { response: { text: () => typeof responseValue === 'string' ? responseValue : JSON.stringify(responseValue) } };
  } });
  const app = require('../dist/app').default;
  listener = app.listen(0, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
  origin = `http://127.0.0.1:${listener.address().port}`;
  const registered = await request('/api/auth/register', { email: 'modules@example.test', password: 'Secure1234!' }, false);
  assert.equal(registered.status, 201); token = registered.data.data.token; userId = registered.data.data.user.id;
});
after(async () => {
  provider.getModel = originalModel; listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve));
  await require('../dist/queues/rag.queue').ragQueue?.close(); require('../dist/config/redis').redisClient.disconnect(); await database.close();
});
test('all learning, career, diagnostics and revision routes require authentication', async () => {
  for (const [path, value] of Object.entries(payloads)) assert.equal((await request(path, value, false)).status, 401, path);
  for (const path of ['/api/placement/practice?type=sql','/api/planner/latest','/api/revision/heatmap','/api/revision/plan','/api/analytics/dashboard','/api/diagnostics/health']) assert.equal((await request(path, undefined, false)).status, 401, path);
  assert.equal((await request('/api/career/roadmap', {}, false)).status, 401);
});
test('malformed module requests fail before invoking providers or persisting data', async () => {
  for (const path of Object.keys(payloads)) assert.equal((await request(path, {})).status, 400, path);
  assert.equal((await request('/api/placement/practice?type=unexpected')).status, 400);
  assert.equal((await request('/api/planner/generate', { ...payloads['/api/planner/generate'], examDate: 'bad-date' })).status, 400);
  assert.equal((await request('/api/planner/generate', { ...payloads['/api/planner/generate'], availableHours: '-4' })).status, 400);
  assert.equal(await prisma.studyPlan.count(), 0);
});
test('coding exercise and review preserve code punctuation; review works before onboarding', async () => {
  responseValue = { title: 'Sum', description: 'Return a sum.', starterCode: 'def add(a, b):\n    pass', testCases: [{ input: '1,2', expectedOutput: '3' }], hints: ['Add the numbers.'] };
  assert.equal((await request('/api/coding/exercise', payloads['/api/coding/exercise'])).status, 200);
  responseValue = { isCorrect: true, feedback: 'Correct.', bugsFound: [], hints: [], optimizedSolution: 'return a + b', timeComplexity: 'O(1)', spaceComplexity: 'O(1)' };
  const review = await request('/api/coding/review', payloads['/api/coding/review']); assert.equal(review.status, 200);
  assert.equal((await prisma.placementProfile.findUnique({ where: { userId } })).practiceCodeCount, 1);
});
test('resume analysis persists valid scores and rejects malformed provider output', async () => {
  responseValue = { atsScore: 78, feedback: 'Clarify outcomes.', improvements: ['Describe measured results.'], skillsIdentified: ['Python'], missingKeywords: [] };
  assert.equal((await request('/api/placement/resume', payloads['/api/placement/resume'])).status, 200);
  responseValue.atsScore = 999;
  assert.equal((await request('/api/placement/resume', payloads['/api/placement/resume'])).status, 502);
  assert.equal((await prisma.placementProfile.findUnique({ where: { userId } })).atsScore, 78);
});
test('mock interviews return valid turns and never fabricate a scorecard on failure', async () => {
  responseValue = { interviewerMessage: 'Explain a Python list.', endSession: false, feedback: '' };
  assert.equal((await request('/api/placement/interview', payloads['/api/placement/interview'])).status, 200);
  const previous = (await prisma.placementProfile.findUnique({ where: { userId } })).readinessScore;
  const original = provider.getModel;
  let calls = 0;
  provider.getModel = () => ({ generateContent: async () => {
    if (++calls > 1) throw Error('scoring failed');
    return { response: { text: () => JSON.stringify({ interviewerMessage: 'Thank you.', endSession: true }) } };
  } });
  try { assert.equal((await request('/api/placement/interview', payloads['/api/placement/interview'])).status, 502); }
  finally { provider.getModel = original; }
  assert.equal((await prisma.placementProfile.findUnique({ where: { userId } })).readinessScore, previous);
});
test('aptitude, SQL and system-design practice validate answer indices', async () => {
  responseValue = { title: 'Practice', question: 'Which result is correct?', options: ['A','B'], correctAnswerIndex: 1, explanation: 'B is correct.', systemDesignRubric: [] };
  for (const type of ['aptitude','sql']) assert.equal((await request('/api/placement/practice?type=' + type)).status, 200);
  responseValue.correctAnswerIndex = 5;
  assert.equal((await request('/api/placement/practice?type=sql')).status, 502);
  responseValue = { title: 'Design a service', question: 'How would you scale it?', explanation: 'Discuss tradeoffs.', systemDesignRubric: ['Capacity','Storage'] };
  assert.equal((await request('/api/placement/practice?type=system_design')).status, 200);
});
test('onboarding and career roadmap use real profile data and persist goals', async () => {
  const profile = { academicYear: '3rd Year', branch: 'CSE', cgpa: 8, strongSubjects: ['Python'], weakSubjects: ['Graphs'], learningPreferences: ['Step-by-step'], careerInterests: ['Backend'] };
  assert.equal((await request('/api/auth/profile', profile)).status, 200);
  responseValue = { title: 'Backend path', roadmapStages: [{ stageName: 'Build', description: 'Build an API.', recommendedSkills: ['Python'] }], weeklyGoals: ['Test an API'], monthlyGoals: ['Ship a service'], skillGapAnalysis: [{ skill: 'System design', importance: 'High', learningResourceSuggestion: 'Practice capacity planning.' }] };
  assert.equal((await request('/api/career/roadmap', {})).status, 200);
  assert.deepEqual(JSON.parse((await prisma.placementProfile.findUnique({ where: { userId } })).weeklyGoals), ['Test an API']);
});
test('study planner persists and retrieves the same schedule with user isolation', async () => {
  responseValue = { title: 'Algorithms', dailyPlan: [{ task: 'Practice graphs', durationMinutes: 60 }], weeklyPlan: [{ week: 'Week 1', focus: 'Graphs', tasks: ['Traversal'] }], monthlyPlan: ['Practice mixed problems'] };
  const generated = await request('/api/planner/generate', payloads['/api/planner/generate']); assert.equal(generated.status, 200);
  assert.equal((await request('/api/planner/latest')).data.data.plan.planId, generated.data.data.planId);
  const other = await request('/api/auth/register', { email: 'other-modules@example.test', password: 'Secure1234!' }, false);
  const saved = token; token = other.data.data.token;
  try { assert.equal((await request('/api/planner/latest')).data.data.plan, null); }
  finally { token = saved; }
});
test('revision heatmap and analytics reflect stored learning records', async () => {
  await prisma.topicMastery.create({ data: { userId, topic: 'Graphs', status: 'WEAK', correctCount: 1, incorrectCount: 3 } });
  assert.deepEqual((await request('/api/revision/heatmap')).data.data.categories.weak, ['Graphs']);
  responseValue = 'Review graph traversal tomorrow.';
  assert.equal((await request('/api/revision/plan')).data.data.plan, responseValue);
  assert.equal((await request('/api/analytics/dashboard')).status, 200);
  assert.equal((await request('/api/diagnostics/health')).status, 200);
});
test('provider failures across generating modules return failures without fake results', async () => {
  providerFailure = true;
  try {
    for (const [path, payload] of Object.entries(payloads)) assert.equal((await request(path, payload)).status, 502, path);
    assert.equal((await request('/api/career/roadmap', {})).status, 502);
    assert.equal((await request('/api/placement/practice?type=aptitude')).status, 502);
  } finally { providerFailure = false; }
});
