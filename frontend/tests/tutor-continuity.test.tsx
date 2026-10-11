import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TutorPage from '../src/app/(dashboard)/tutor/page';
const mock = vi.hoisted(() => ({ request: vi.fn(), stream: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/components/CollapsiblePanel', () => ({ formatExplanations: (text: string) => text }));
vi.mock('@/lib/api', () => ({ apiRequest: mock.request, setupStreamingTutor: mock.stream, getStoredEmail: () => 'student@example.test' }));
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mock.stream.mockReturnValue(vi.fn());
  mock.request.mockImplementation(async (url: string) => url === '/api/rag/documents' ? { data: { documents: [{id:'cuda',title:'CUDA notes',status:'READY'}] } } : url.includes('?') ? { data: { conversations: [{id:'os',title:'Round robin',subject:'OperatingSystems',updatedAt:'2026-10-10'}],nextCursor:null } } : { data: {id:'os',messages:[{role:'user',content:'Explain round robin'},{role:'model',content:'Saved OS explanation'}],subject:'OperatingSystems',explanationMode:'visual',ragMode:false,documentId:null} });
});
describe('tutor continuity', () => {
  it('reopens saved history and restores the subject and chosen teaching style', async () => {
    render(<TutorPage />);
    fireEvent.click(screen.getByRole('button',{name:'History'}));
    fireEvent.click(await screen.findByRole('button',{name:/^Round robin/}));
    expect(await screen.findByText('Saved OS explanation')).toBeTruthy();
    expect((screen.getByLabelText('Explanation style') as HTMLSelectElement).value).toBe('visual');
  });
  it('retains messages across page unmount and restores the active conversation from the server', async () => {
    localStorage.setItem('tutor-active:student@example.test',JSON.stringify({conversationId:'os',messages:[],subject:'OperatingSystems',mode:'visual'}));
    const view = render(<TutorPage />);
    await screen.findByText('Saved OS explanation'); view.unmount();
    render(<TutorPage />); expect(await screen.findByText('Saved OS explanation')).toBeTruthy();
    expect(mock.request).toHaveBeenCalledWith('/api/tutor/conversations/os');
  });
  it('Explain submits the selected document while retaining the active conversation', async () => {
    localStorage.setItem('tutor-active:student@example.test',JSON.stringify({conversationId:'os',messages:[{role:'user',content:'Earlier question'}],subject:'OperatingSystems',mode:'visual'}));
    sessionStorage.setItem('pendingTutorRequest',JSON.stringify({question:'Explain CUDA',documentId:'cuda'}));
    render(<TutorPage />);
    await waitFor(() => expect(mock.stream).toHaveBeenCalled());
    const args = mock.stream.mock.calls[0][0];
    expect(args.documentId).toBe('cuda'); expect(args.conversationId).toBe('os'); expect(args.ragMode).toBe(true); expect(args.explanationMode).toBe('step_by_step');
    args.onContent('CUDA is parallel computing.'); args.onDone();
    expect(sessionStorage.getItem('pendingTutorRequest')).toBeNull();
  });
  it('keeps an in-flight answer when navigating away and returning', async () => {
    const view = render(<TutorPage />);
    const input = screen.getByLabelText('Your question');
    fireEvent.change(input,{target:{value:'Explain scheduling'}});
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(mock.stream).toHaveBeenCalled());
    const args = mock.stream.mock.calls[0][0]; args.onMeta({conversationId:'os'});
    view.unmount(); render(<TutorPage />);
    args.onContent('An answer completed while navigating.'); args.onDone();
    expect(await screen.findByText('An answer completed while navigating.')).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText('Your question') as HTMLInputElement).disabled).toBe(false));
  });

});

it('confirms deletion, clears the active conversation and supports undo', async () => {
  localStorage.setItem('tutor-active:student@example.test',JSON.stringify({conversationId:'os',messages:[],subject:'OperatingSystems',mode:'visual'}));
  const defaultRequest=mock.request.getMockImplementation()!;
  let deleted=false;
  mock.request.mockImplementation(async (url: string, method?: string) => {
    if (method==='DELETE') { deleted=true; return {status:'success'}; }
    if (url.endsWith('/restore')) { deleted=false; return {status:'success'}; }
    if (url.includes('conversations?') && deleted) return {data:{conversations:[],nextCursor:null}};
    return defaultRequest(url);
  });
  render(<TutorPage />);await screen.findByText('Saved OS explanation');
  fireEvent.click(screen.getByRole('button',{name:'History'}));
  fireEvent.click(await screen.findByRole('button',{name:'Delete Round robin'}));
  expect(mock.request).not.toHaveBeenCalledWith('/api/tutor/conversations/os','DELETE');
  fireEvent.click(screen.getByRole('button',{name:'Confirm delete'}));
  await screen.findByText('No saved conversations found.');
  expect(screen.queryByText('Saved OS explanation')).toBeNull();
  await waitFor(() => expect(JSON.parse(localStorage.getItem('tutor-active:student@example.test')!).conversationId).toBe(''));
  fireEvent.click(screen.getByRole('button',{name:'Undo'}));
  await screen.findByRole('button',{name:/^Round robin/});
  expect(mock.request).toHaveBeenCalledWith('/api/tutor/conversations/os/restore','POST');
});

it('clears cached messages when the conversation was deleted in another session', async () => {
  localStorage.setItem('tutor-active:student@example.test',JSON.stringify({conversationId:'os',messages:[{role:'model',content:'Deleted cached answer'}]}));
  const defaultRequest=mock.request.getMockImplementation()!;
  mock.request.mockImplementation(async (url: string) => {
    if (url==='/api/tutor/conversations/os') throw new Error('Conversation not found.');
    return defaultRequest(url);
  });
  render(<TutorPage />);
  await waitFor(()=>expect(screen.queryByText('Deleted cached answer')).toBeNull());
  await waitFor(()=>expect(JSON.parse(localStorage.getItem('tutor-active:student@example.test')!).conversationId).toBe(''));
});
