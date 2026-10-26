const { getJson, getJsonCached } = require('./net');

const API = 'https://api.modrinth.com/v2';
const q = (o) => encodeURIComponent(JSON.stringify(o));

// Which Modrinth "loader" a content type is published for.
function loadersFor(type, loader) {
  if (type === 'mod') return [loader];
  if (type === 'shader') return ['iris', 'optifine'];
  return ['minecraft'];
}

async function search({ query = '', type = 'mod', gameVersion, loader = 'fabric', offset = 0, limit = 24, sort = 'relevance' }) {
  const facets = [[`project_type:${type}`]];
  if (gameVersion) facets.push([`versions:${gameVersion}`]);
  if (type === 'mod' || type === 'modpack') facets.push([`categories:${loader}`]);
  const url = `${API}/search?query=${encodeURIComponent(query)}&facets=${q(facets)}&index=${sort}&offset=${offset}&limit=${limit}`;
  return getJson(url);
}

async function getProject(idOrSlug) {
  return getJsonCached(`${API}/project/${encodeURIComponent(idOrSlug)}`);
}

async function getProjects(ids) {
  if (!ids.length) return [];
  return getJsonCached(`${API}/projects?ids=${q(ids)}`);
}

async function getVersion(id) {
  return getJsonCached(`${API}/version/${encodeURIComponent(id)}`);
}

// Newest compatible version, preferring releases over betas/alphas.
async function getCompatibleVersion(idOrSlug, type, gameVersion, loader, { fresh } = {}) {
  const url = `${API}/project/${encodeURIComponent(idOrSlug)}/version?game_versions=${q([gameVersion])}&loaders=${q(loadersFor(type, loader))}`;
  const list = fresh ? await getJson(url) : await getJsonCached(url, 5 * 60 * 1000);
  if (!list.length) return null;
  return list.find((v) => v.version_type === 'release') || list[0];
}

// All versions of a project for the given loaders, newest first.
async function listVersions(idOrSlug, loaders) {
  return getJsonCached(`${API}/project/${encodeURIComponent(idOrSlug)}/version?loaders=${q(loaders)}`, 5 * 60 * 1000);
}

// One request that maps file hashes (sha1) to the Modrinth versions they belong to; unknown files are absent.
async function lookupByHashes(hashes) {
  if (!hashes.length) return {};
  return getJson(`${API}/version_files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes, algorithm: 'sha1' }),
  });
}

// Latest compatible version for each file hash, in one request (instead of one request per mod).
async function latestForHashes(hashes, type, loader, gameVersion) {
  if (!hashes.length) return {};
  return getJson(`${API}/version_files/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes, algorithm: 'sha1', loaders: loadersFor(type, loader), game_versions: [gameVersion] }),
  });
}

module.exports = { search, getProject, getProjects, getVersion, getCompatibleVersion, listVersions, lookupByHashes, latestForHashes };
