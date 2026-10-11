import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CareerPage from '../src/app/(dashboard)/career/page';
import { uploadResume } from '../src/lib/api';
vi.mock('@/components/NoticeProvider', () => ({ useNotice: () => vi.fn() }));
const analysis = {atsScore:82,feedback:'Clear relevant experience.',improvements:['Show impact.','Fix dates.','Clarify role.','Improve summary.','Add evidence.'],missingKeywords:['Testing']};
beforeEach(() => { localStorage.clear(); localStorage.setItem('token','demo-token'); vi.restoreAllMocks(); });
it('uploads the actual selected file, displays all feedback and reloads the saved review', async () => {
  let saved=false;
  const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async (_url, init) => {
    if(init?.method==='POST') {
      const form=init.body as FormData;
      expect((form.get('file') as File).name).toBe('resume.pdf');
      expect(form.get('targetRole')).toBe('Software Engineer');
      expect((init.headers as Record<string,string>)['Content-Type']).toBeUndefined();
      saved=true;return new Response(JSON.stringify({status:'success',data:{analysis}}));
    }
    return new Response(JSON.stringify({data:{review:saved?{analysis,targetRole:'Software Engineer',fileName:'resume.pdf'}:null}}));
  });
  const view=render(<CareerPage />);
  fireEvent.click(screen.getByRole('button',{name:'Resume review'}));
  fireEvent.change(screen.getByLabelText('Resume file'),{target:{files:[new File(['%PDF-test'],'resume.pdf',{type:'application/pdf'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Audit Resume Score'}));
  expect(await screen.findByText('82 / 100')).toBeTruthy();
  expect(screen.getByText('Add evidence.')).toBeTruthy();
  view.unmount();render(<CareerPage />);
  fireEvent.click(screen.getByRole('button',{name:'Resume review'}));
  expect(await screen.findByText('Review: resume.pdf')).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
it('keeps file errors visible and allows a retry without losing the saved review', async () => {
  let fail=true;
  vi.spyOn(globalThis,'fetch').mockImplementation(async (_url,init) => init?.method==='POST' ? fail ? new Response(JSON.stringify({message:'No readable text was extracted. Scanned PDFs need OCR or a text version.'}),{status:422}) : new Response(JSON.stringify({status:'success',data:{analysis}})) : new Response(JSON.stringify({data:{review:null}})));
  render(<CareerPage />);fireEvent.click(screen.getByRole('button',{name:'Resume review'}));
  fireEvent.change(screen.getByLabelText('Resume file'),{target:{files:[new File(['scan'],'resume.pdf')]}});
  fireEvent.click(screen.getByRole('button',{name:'Audit Resume Score'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Scanned PDFs need OCR');
  fail=false;await waitFor(()=>expect((screen.getByRole('button',{name:'Audit Resume Score'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Audit Resume Score'}));
  await screen.findByText('82 / 100');expect(screen.queryByRole('alert')).toBeNull();
});
it('rejects empty and unsupported files and handles a hosting error instead of exposing JSON parse errors', async () => {
  const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('Request Entity Too Large',{status:413}));
  await expect(uploadResume(new File([], 'resume.pdf'),'')).rejects.toThrow('empty');
  await expect(uploadResume(new File(['test'], 'resume.xls'),'')).rejects.toThrow('Choose PDF');
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(uploadResume(new File(['test'], 'resume.pdf'),'')).rejects.toThrow('smaller than 4 MiB');
});
