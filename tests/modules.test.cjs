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

test('legacy quiz retains operational quota status and masks unexpected provider details', async () => {
  const savedModel = provider.getModel;
  const { AppError } = require('../dist/middleware/error.middleware');
  try {
    provider.getModel = () => ({ generateContent: async () => { throw new AppError('Provider usage limit reached.', 429); } });
    const limited = await request('/api/quiz/generate', { topic: 'Python', questionCount: 2 });
    assert.equal(limited.status, 429);
    assert.match(limited.data.message, /usage limit/);
    provider.getModel = () => ({ generateContent: async () => { throw Error('SDK detail with credential=secret-placeholder'); } });
    const failed = await request('/api/quiz/generate', { topic: 'Python', questionCount: 2 });
    assert.equal(failed.status, 502);
    assert.ok(!JSON.stringify(failed.data).includes('secret-placeholder'));
  } finally { provider.getModel = savedModel; }
});
test('history restores legacy OS discussions, persisted source/style, pagination and ownership', async () => {
  const c = await prisma.conversation.create({ data: { userId, subject: 'OperatingSystems', title: 'Round robin', ragMode: true, documentId: 'selected-source', explanationMode: 'visual' } });
  const service = new (require('../dist/services/tutor.service').TutorService)();
  await service.saveMessages(c.id, 'Explain round robin scheduling', 'CPU scheduling rotates between ready processes.');
  const list = await request('/api/tutor/conversations?search=round');
  assert.equal(list.status,200); assert.ok(list.data.data.conversations.some(row => row.id === c.id));
  const detail = await request('/api/tutor/conversations/' + c.id);
  assert.equal(detail.data.data.messages.length,2); assert.equal(detail.data.data.documentId,'selected-source'); assert.equal(detail.data.data.explanationMode,'visual');
  const outsider = await prisma.user.create({ data: { email: 'history-other@example.test', password: 'irrelevant' } });
  const privateChat = await prisma.conversation.create({ data: { userId: outsider.id, title: 'Private' } });
  assert.equal((await request('/api/tutor/conversations/' + privateChat.id)).status,404);
  assert.equal((await request('/api/tutor/conversations?cursor=' + privateChat.id)).status,404);
  for (let i=0;i<103;i++) await prisma.message.create({ data: { conversationId: c.id, role: 'user', content: 'History ' + i, createdAt: new Date(Date.now()+i+100) } });
  const first = await request('/api/tutor/conversations/' + c.id);
  assert.equal(first.data.data.messages.length,100); assert.ok(first.data.data.olderCursor);
  const second = await request('/api/tutor/conversations/' + c.id + '?before=' + first.data.data.olderCursor);
  assert.equal(second.data.data.messages.length,5);
  const recall = await request('/api/tutor/ask', { question: 'Can you recall my old topics?' });
  assert.equal(recall.status,200); assert.match(recall.data.data.response,/OperatingSystems/); assert.match(recall.data.data.response,/Round robin/);
});
test('invalid teaching mode fails before saving a new conversation; selected practice mode stays focused', async () => {
  const { teachingPolicy } = require('../dist/services/teaching-policy');
  assert.match(teachingPolicy('practice'), /one/i); assert.match(teachingPolicy('step_by_step'), /why/i);
  const count = await prisma.conversation.count();
  assert.equal((await request('/api/tutor/ask',{ question: 'Explain OS', explanationMode: 'invalid' })).status,400);
  assert.equal(await prisma.conversation.count(),count);
});
test('resume file extraction succeeds and malformed files do not alter scores', async () => {
  responseValue = { atsScore: 81, feedback: 'Add concrete outcomes.', improvements: ['Quantify outcomes where supported.'], skillsIdentified: ['Python'], missingKeywords: ['Testing'] };
  for (const fixture of ['txt','docx','xlsx','odt']) {
    const form = new FormData();
    const content = fixture === 'txt' ? Buffer.from('Python developer with PostgreSQL projects and automated tests.') : require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures','resume.'+fixture));
    form.append('file',new Blob([content]),'resume.'+fixture); form.append('targetRole','Backend Engineer');
    const res = await fetch(origin+'/api/placement/resume/upload',{ method:'POST',headers:{ Authorization:`Bearer ${token}` },body:form });
    assert.equal(res.status,200,fixture); assert.equal((await res.json()).data.analysis.atsScore,81);
  }
  const form = new FormData(); form.append('file',new Blob(['not a pdf']),'resume.pdf');
  assert.equal((await fetch(origin+'/api/placement/resume/upload',{ method:'POST',headers:{ Authorization:`Bearer ${token}` },body:form })).status,422);
  assert.equal((await prisma.placementProfile.findUnique({where:{userId}})).atsScore,81);
});

test('deleted history is owner scoped, excluded from recall and can be restored', async () => {
  const chat = await prisma.conversation.create({ data: { userId, title: 'UniqueDeletedTopic', subject: 'DeletedSubject', messages: { create: [{ role: 'user', content: 'UniqueDeletedTopic' }, { role: 'model', content: 'Explanation' }] } } });
  const outsider = await prisma.user.create({ data: { email: 'delete-other@example.test', password: 'irrelevant' } });
  const otherChat = await prisma.conversation.create({ data: { userId: outsider.id, title: 'Private' } });
  async function mutate(id, method, suffix='') {
    const res = await fetch(origin+'/api/tutor/conversations/'+id+suffix,{method,headers:{Authorization:`Bearer ${token}`}}); return res.status;
  }
  assert.equal(await mutate(otherChat.id,'DELETE'),404);
  assert.equal(await mutate(chat.id,'DELETE'),200);
  assert.equal((await request('/api/tutor/conversations/'+chat.id)).status,404);
  assert.equal((await request('/api/tutor/conversations?search=UniqueDeletedTopic')).data.data.conversations.length,0);
  assert.equal((await request('/api/tutor/ask',{question:'Explain something',conversationId:chat.id})).status,404);
  const recall=await request('/api/tutor/ask',{question:'Can you recall my old topics?'});
  assert.ok(!recall.data.data.response.includes('UniqueDeletedTopic'));
  assert.equal(await prisma.message.count({where:{conversationId:chat.id}}),2);
  assert.equal(await mutate(otherChat.id,'POST','/restore'),404);
  assert.equal(await mutate(chat.id,'POST','/restore'),200);
  assert.equal((await request('/api/tutor/conversations/'+chat.id)).data.data.messages.length,2);
});
test('saved resume review survives retrieval and failed replacement; is private', async () => {
  const saved=await request('/api/placement/resume');
  assert.equal(saved.status,200); assert.equal(saved.data.data.review.analysis.atsScore,81);
  assert.equal(saved.data.data.review.fileName,'resume.odt');
  const bad=new FormData();bad.append('file',new Blob(['broken']),'resume.pdf');
  assert.equal((await fetch(origin+'/api/placement/resume/upload',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:bad})).status,422);
  assert.deepEqual((await request('/api/placement/resume')).data.data.review,saved.data.data.review);
  const another=await request('/api/auth/register',{email:'resume-private@example.test',password:'Secure1234!'},false);
  const previous=token;token=another.data.data.token;
  try { assert.equal((await request('/api/placement/resume')).data.data.review,null); }
  finally { token=previous; }
});
