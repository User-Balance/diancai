// Only extract a one-time email token. Never follow a supplied URL or its redirect.
export function parseLoginLink(input, projectUrl) {
  const text = String(input || '').trim();
  const invalid = () => new Error('请复制本项目邮件中尚未点击的完整登录链接');
  if (!text || text.length > 4096) throw invalid();
  let link;
  try { link = new URL(text); } catch { throw invalid(); }
  if (link.protocol !== 'https:' || link.origin !== new URL(projectUrl).origin ||
      link.username || link.password || link.hash || link.pathname !== '/auth/v1/verify') throw invalid();
  const params = link.searchParams;
  if (params.getAll('type').length !== 1 ||
      params.getAll('token').length + params.getAll('token_hash').length !== 1) throw invalid();
  const token = params.get('token_hash') || params.get('token');
  if (!['email', 'magiclink'].includes(params.get('type')) || !/^[a-zA-Z0-9_-]{32,256}$/.test(token || '')) throw invalid();
  return { token_hash: token, type: 'email' };
}
