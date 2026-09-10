const BASE_URL = 'http://localhost:3001';

async function runTest() {
  try {
    console.log('--- E2E TEST START ---');

    // 1. Register User
    console.log('\n[1/3] Registering user...');
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@test.com', password: 'secure_password_123' }),
    });
    const regData = await regRes.json();
    console.log('Register Response Status:', regRes.status);
    console.log('Register Response Body:', JSON.stringify(regData, null, 2));

    // If account already exists from previous runs, we just log in
    let token = '';
    if (regRes.status === 201 || regRes.status === 409) {
      // 2. Login User
      console.log('\n[2/3] Logging in user...');
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'student@test.com', password: 'secure_password_123' }),
      });
      const loginData = await loginRes.json();
      console.log('Login Response Status:', loginRes.status);
      console.log('Login Response Body:', JSON.stringify(loginData, null, 2));
      token = loginData.data?.token;
    }

    if (!token) {
      throw new Error('Failed to retrieve token from login/register.');
    }

    // Onboarding User Profile
    console.log('\n[Onboarding] Setting up student profile...');
    const onboardRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        academicYear: '3rd Year',
        branch: 'Computer Science',
        cgpa: '8.2',
        strongSubjects: ['Databases', 'Algorithms'],
        weakSubjects: ['Physics', 'TOC'],
        learningPreferences: ['Mixed'],
        careerInterests: ['Full-Stack Developer']
      }),
    });
    const onboardData = await onboardRes.json();
    console.log('Onboard Profile Response Status:', onboardRes.status);

    // 3. Ask a Tutoring Question
    console.log('\n[3/5] Asking a question using JWT Authorization...');
    const askRes = await fetch(`${BASE_URL}/api/tutor/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ question: 'Explain why the sky is blue' }),
    });
    const askData = await askRes.json();
    console.log('Ask Tutor Response Status:', askRes.status);

    // 4. Fetch Knowledge Graph
    console.log('\n[4/5] Fetching Knowledge Graph...');
    const graphRes = await fetch(`${BASE_URL}/api/rag/graph`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const graphData = await graphRes.json();
    console.log('Graph Response Status:', graphRes.status);
    console.log('Graph Data (Nodes Count):', graphData.data?.nodes?.length || 0);

    // 4.5. Test Career Roadmap Generator
    console.log('\n[4.5/5] Generating Career Roadmap...');
    const careerRes = await fetch(`${BASE_URL}/api/career/roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ skills: ['Git', 'React'] }),
    });
    const careerData = await careerRes.json();
    console.log('Career Roadmap Status:', careerRes.status);
    console.log('Roadmap title:', careerData.data?.title);

    // 4.6. Test Coding Challenge & Review
    console.log('\n[4.6/5] Generating Coding Exercise...');
    const exerciseRes = await fetch(`${BASE_URL}/api/coding/exercise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ language: 'Python', topic: 'Binary Search', difficulty: 'easy' }),
    });
    const exerciseData = await exerciseRes.json();
    console.log('Coding Exercise Status:', exerciseRes.status);
    console.log('Exercise Title:', exerciseData.data?.title);

    console.log('\n[4.7/5] Submitting Code for Review...');
    const reviewRes = await fetch(`${BASE_URL}/api/coding/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        language: 'Python',
        problemTitle: exerciseData.data?.title || 'Binary Search',
        description: exerciseData.data?.description || 'Implement binary search',
        studentCode: 'def binary_search(arr, x):\n    # student code\n    return -1'
      }),
    });
    const reviewData = await reviewRes.json();
    console.log('Code Review Status:', reviewRes.status);
    console.log('Code Review Feedback:', reviewData.data?.feedback);

    // 5. Fetch Profile and check Learning DNA
    console.log('\n[5/5] Fetching Profile & Learning DNA...');
    const profileRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const profileData = await profileRes.json();
    console.log('Profile Response Status:', profileRes.status);
    console.log('Learning DNA values:', {
      currentLevel: profileData.data?.profile?.currentLevel,
      learningStyle: profileData.data?.profile?.learningStyle,
      retentionRate: profileData.data?.profile?.retentionRate,
      studyConsistency: profileData.data?.profile?.studyConsistency,
      confidenceLevel: profileData.data?.profile?.confidenceLevel,
      knowledgeGaps: profileData.data?.profile?.knowledgeGaps
    });

    console.log('\n--- E2E TEST COMPLETED ---');
  } catch (error) {
    console.error('Test script failed:', error);
  }
}

runTest();
