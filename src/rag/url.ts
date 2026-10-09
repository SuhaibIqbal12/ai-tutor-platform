import { lookup } from 'dns/promises';
import { isIP } from 'net';
import axios from 'axios';
import { AppError } from '../middleware/error.middleware';
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a,b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  // Deny IPv4-mapped, local, multicast and reserved IPv6 addresses.
  return isIP(address) === 6 && /^2[0-9a-f]{3}:/i.test(address) && !address.toLowerCase().startsWith('2001:db8:');
}
export async function validatePublicUrl(value: string): Promise<URL> {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError('Enter a valid HTTPS or HTTP URL.', 400); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new AppError('Only public HTTP(S) URLs on standard ports are supported.', 400);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(x => !isPublicAddress(x.address))) throw new AppError('Private and internal network URLs are not allowed.', 400);
  return url;
}
export function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host)) return null;
  const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new AppError('Use an individual YouTube video URL.', 400);
  return id;
}
export async function crawlPublicPage(value: string): Promise<string> {
  let url = await validatePublicUrl(value);
  for (let redirects = 0; redirects < 4; redirects++) {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    // Pin DNS after validation to close the DNS-rebinding window.
    const address = (await lookup(host, { all: true }))[0];
    if (!address || !isPublicAddress(address.address)) throw new AppError('Private network URLs are not allowed.', 400);
    const { Agent: HttpAgent } = require('http');
    const { Agent: HttpsAgent } = require('https');
    const options = { lookup: (_host: string, _options: any, callback: any) => {
      if (_options?.all) callback(null, [address]); else callback(null, address.address, address.family);
    } };
    const result = await axios.get(url.href, {
      httpAgent: new HttpAgent(options), httpsAgent: new HttpsAgent(options), proxy: false,
      maxRedirects: 0, timeout: 15000, maxContentLength: 2 * 1024 * 1024,
      validateStatus: status => status >= 200 && status < 400,
    });
    if (result.status >= 300 && result.headers.location) { url = await validatePublicUrl(new URL(result.headers.location, url).href); continue; }
    if (typeof result.data !== 'string') throw new AppError('URL did not return a readable webpage.', 422);
    return result.data.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  }
  throw new AppError('Too many webpage redirects.', 422);
}
