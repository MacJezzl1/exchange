import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const cms = require('../data/cms-helper');

describe('Phase 7: CapeChain Labs Branding, Visa Card & CMS Verification', () => {
  it('has verified branding assets in place with non-zero file sizes', () => {
    const webLogo = path.join(__dirname, '..', 'apps', 'web', 'public', 'logo.png');
    const webCard = path.join(__dirname, '..', 'apps', 'web', 'public', 'visa-card.jpg');
    const adminLogo = path.join(__dirname, '..', 'apps', 'admin', 'public', 'logo.png');
    const adminCard = path.join(__dirname, '..', 'apps', 'admin', 'public', 'visa-card.jpg');

    expect(fs.existsSync(webLogo)).toBe(true);
    expect(fs.statSync(webLogo).size).toBeGreaterThan(1000);

    expect(fs.existsSync(webCard)).toBe(true);
    expect(fs.statSync(webCard).size).toBeGreaterThan(10000);

    expect(fs.existsSync(adminLogo)).toBe(true);
    expect(fs.existsSync(adminCard)).toBe(true);
  });

  it('manages media press releases dynamically via CMS helper', () => {
    const initial = cms.getCmsData();
    expect(Array.isArray(initial.media)).toBe(true);
    const initialCount = initial.media.length;

    const testPost = cms.addMediaPost({
      title: 'Automated Test: CapeChain Ecosystem Milestone',
      category: 'Product',
      author: 'Test Runner',
      summary: 'Verified end-to-end CMS synchronization across Admin and User portals.',
      content: 'Detailed press release body verifying live distribution.',
      featured: false,
    });

    expect(testPost.id).toMatch(/^med_/);
    expect(testPost.title).toBe('Automated Test: CapeChain Ecosystem Milestone');

    const updated = cms.getCmsData();
    expect(updated.media.length).toBe(initialCount + 1);

    // Delete post to clean up
    cms.deleteMediaPost(testPost.id);
    const afterDelete = cms.getCmsData();
    expect(afterDelete.media.length).toBe(initialCount);
  });

  it('manages career openings dynamically via CMS helper', () => {
    const initial = cms.getCmsData();
    expect(Array.isArray(initial.careers)).toBe(true);
    const initialCount = initial.careers.length;

    const testJob = cms.addCareerOpening({
      title: 'Senior Quantitative Systems Engineer',
      department: 'Engineering',
      location: 'Remote',
      compensation: '$220,000 - $280,000 + Equity',
      description: 'Building zero-latency execution pipelines.',
      requirements: ['Rust or C++ proficiency', 'Experience with high-frequency order books'],
    });

    expect(testJob.id).toMatch(/^job_/);
    expect(testJob.active).toBe(true);

    const updated = cms.getCmsData();
    expect(updated.careers.length).toBe(initialCount + 1);

    // Delete job to clean up
    cms.deleteCareerOpening(testJob.id);
    const afterDelete = cms.getCmsData();
    expect(afterDelete.careers.length).toBe(initialCount);
  });

  it('registers and records CapeChain Visa metal card waitlist submissions', () => {
    const entry = cms.joinCardWaitlist({
      email: 'investor_vip@test.domain',
      cardTier: 'Obsidian Black (Metal)',
      country: 'South Africa',
    });

    expect(entry.id).toMatch(/^wait_/);
    expect(entry.email).toBe('investor_vip@test.domain');
    expect(entry.cardTier).toBe('Obsidian Black (Metal)');

    const data = cms.getCmsData();
    const found = data.cardWaitlist.find((w: any) => w.id === entry.id);
    expect(found).toBeDefined();
    expect(found.email).toBe('investor_vip@test.domain');
  });

  it('contains Apple and Google SSO auth providers and Visa card in web application HTML', () => {
    const webServerPath = path.join(__dirname, '..', 'apps', 'web', 'server.js');
    const webServerContent = fs.readFileSync(webServerPath, 'utf8');

    // Branding and Visa
    expect(webServerContent).toContain('CapeChain');
    expect(webServerContent).toContain('Visa');
    expect(webServerContent).toContain('Obsidian');

    // Apple and Google SSO
    expect(webServerContent).toContain('Continue with Apple');
    expect(webServerContent).toContain('Continue with Google');
    expect(webServerContent).toContain('Touch ID / Face ID');

    // Media and Careers
    expect(webServerContent).toContain('/media');
    expect(webServerContent).toContain('/careers');
  });

  it('contains Admin Portal CMS controls for Media and Careers and Visa Waitlist', () => {
    const adminServerPath = path.join(__dirname, '..', 'apps', 'admin', 'server.js');
    const adminServerContent = fs.readFileSync(adminServerPath, 'utf8');

    expect(adminServerContent).toContain('Media & Press CMS');
    expect(adminServerContent).toContain('Careers & Hiring CMS');
    expect(adminServerContent).toContain('Visa Card Waitlist');
    expect(adminServerContent).toContain('/admin/api/cms/media');
    expect(adminServerContent).toContain('/admin/api/cms/careers');
  });
});
