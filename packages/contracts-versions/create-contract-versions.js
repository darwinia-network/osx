const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const monorepoRoot = path.join(__dirname, '..');
const contractsDir = path.join(monorepoRoot, 'contracts');
const contractVersionsDir = path.join(__dirname, 'dist');
const commitHashes = require('./commit_hashes.json');

async function getCurrentBranch() {
  const {stdout} = await exec('git branch --show-current', {cwd: contractsDir});
  return stdout.trim();
}

async function buildContracts(commit) {
  try {
    await exec(`git checkout ${commit}`, {cwd: contractsDir});
    await exec('yarn build', {cwd: contractsDir});
  } catch (error) {
    console.error('Error building contracts:', error);
  }
}

async function copyContracts(commit, versionName) {
  try {
    const srcArtifacts = path.join(contractsDir, 'artifacts/src');
    const destArtifacts = path.join(
      contractVersionsDir,
      versionName,
      'artifacts'
    );
    await fs.copy(srcArtifacts, destArtifacts);

    const srcContracts = path.join(contractsDir, 'src');
    const destContracts = path.join(
      contractVersionsDir,
      versionName,
      'contracts'
    );
    await fs.copy(srcContracts, destContracts, {
      filter: src => src.endsWith('.sol'),
    });

    const srcActiveContracts = path.join(monorepoRoot, 'active_contracts.json');
    const destActiveContracts = path.join(
      contractVersionsDir,
      versionName,
      'active_contracts.json'
    );
    await fs.copy(srcActiveContracts, destActiveContracts);
  } catch (error) {
    console.error('Error copying contracts:', error);
  }
}

async function createVersions() {
  const currentBranch = await getCurrentBranch();

  for (const version of commitHashes.versions) {
    await buildContracts(version.commit);
    await copyContracts(version.commit, version.name);
  }

  // Return to the original branch
  await exec(`git checkout ${currentBranch}`, {cwd: contractsDir});
}

createVersions();
