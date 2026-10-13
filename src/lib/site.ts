import fs from 'node:fs';
import path from 'node:path';
import { siteConfig, features } from '@site';

const pub = (f: string) => path.join(process.cwd(), 'public', f);

/** True when public/cv.pdf (or whatever `files.cv` is) exists at build time. */
export const hasCV = fs.existsSync(pub(siteConfig.files.cv));
export const hasProfile = fs.existsSync(pub(siteConfig.files.profile));

export interface SocialLink {
  id: string;
  label: string;
  url: string;
}

const LABELS: Record<string, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  x: 'X',
  scholar: 'Google Scholar',
  orcid: 'ORCID',
  huggingface: 'Hugging Face',
  kaggle: 'Kaggle',
};

/** Only links that are filled in. */
export const socialLinks: SocialLink[] = Object.entries(siteConfig.social)
  .filter(([, url]) => typeof url === 'string' && url.trim() !== '')
  .map(([id, url]) => ({ id, label: LABELS[id] ?? id, url: url.trim() }));

export { siteConfig, features };

/** Local time in the configured place, formatted at build/run time by the client. */
export const placeReadout = siteConfig.place
  ? `${Math.abs(siteConfig.place.lat).toFixed(4)}° ${siteConfig.place.lat >= 0 ? 'N' : 'S'}  ${Math.abs(
      siteConfig.place.lon,
    ).toFixed(4)}° ${siteConfig.place.lon >= 0 ? 'E' : 'W'}`
  : '';
