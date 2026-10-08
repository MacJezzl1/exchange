const fs = require('fs');
const path = require('path');

const CMS_FILE_PATH = path.join(__dirname, 'cms.json');

function getCmsData() {
  try {
    if (!fs.existsSync(CMS_FILE_PATH)) {
      return { media: [], careers: [], cardWaitlist: [] };
    }
    const raw = fs.readFileSync(CMS_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[CMS] Error reading cms.json:', err);
    return { media: [], careers: [], cardWaitlist: [] };
  }
}

function saveCmsData(data) {
  try {
    fs.writeFileSync(CMS_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[CMS] Error saving cms.json:', err);
    return false;
  }
}

function addMediaPost(post) {
  const data = getCmsData();
  const newPost = {
    id: 'med_' + Date.now(),
    title: post.title || 'Untitled Announcement',
    slug: (post.title || 'announcement').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    category: post.category || 'General',
    author: post.author || 'CapeChain Team',
    publishedAt: new Date().toISOString(),
    summary: post.summary || '',
    content: post.content || '',
    featured: Boolean(post.featured),
    readTime: post.readTime || '3 min read',
  };
  data.media.unshift(newPost);
  saveCmsData(data);
  return newPost;
}

function deleteMediaPost(id) {
  const data = getCmsData();
  data.media = data.media.filter(m => m.id !== id);
  saveCmsData(data);
  return true;
}

function addCareerOpening(job) {
  const data = getCmsData();
  const newJob = {
    id: 'job_' + Date.now(),
    title: job.title || 'Open Position',
    department: job.department || 'General',
    location: job.location || 'Remote',
    type: job.type || 'Full-time',
    experience: job.experience || 'Mid / Senior',
    compensation: job.compensation || 'Competitive + Equity',
    description: job.description || '',
    requirements: Array.isArray(job.requirements) ? job.requirements : (job.requirements ? job.requirements.split('\n').filter(Boolean) : []),
    active: true,
  };
  data.careers.unshift(newJob);
  saveCmsData(data);
  return newJob;
}

function deleteCareerOpening(id) {
  const data = getCmsData();
  data.careers = data.careers.filter(c => c.id !== id);
  saveCmsData(data);
  return true;
}

function joinCardWaitlist(entry) {
  const data = getCmsData();
  const waitlistEntry = {
    id: 'wait_' + Date.now(),
    email: entry.email,
    walletAddress: entry.walletAddress || null,
    cardTier: entry.cardTier || 'Obsidian Black',
    country: entry.country || 'Global',
    registeredAt: new Date().toISOString(),
  };
  if (!data.cardWaitlist) data.cardWaitlist = [];
  data.cardWaitlist.push(waitlistEntry);
  saveCmsData(data);
  return waitlistEntry;
}

module.exports = {
  getCmsData,
  saveCmsData,
  addMediaPost,
  deleteMediaPost,
  addCareerOpening,
  deleteCareerOpening,
  joinCardWaitlist,
};
