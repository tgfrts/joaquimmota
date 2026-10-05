import { robotsText } from '../lib/seo';
export const prerender = true;
export function GET() {
  return new Response(robotsText(import.meta.env.SITE_ENV), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
