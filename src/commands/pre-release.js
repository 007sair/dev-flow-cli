const fs = require('fs');
const path = require('path');
const semver = require('semver');
const { log, execCommand, askList, askQuestion, askConfirm, checkGitClean, getRemoteFeatBranches } = require('../utils');

function getPackageJson() {
  const pPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pPath)) throw new Error('package.json not found');
  return JSON.parse(fs.readFileSync(pPath, 'utf8'));
}

async function preRelease() {
  log('\n🚀 开始阶段 2：预发布', 'cyan');

  // 0. 检查工作区状态
  if (!checkGitClean()) {
    process.exit(1);
  }

  // 1. 同步并选择公共特性分支
  log('🔄 同步远程分支信息...', 'blue');
  try {
    execCommand('git fetch origin');
  } catch (e) {
    log('Fetch 失败 (可能是网络问题)，继续使用本地缓存...', 'yellow');
  }

  const remoteFeatChoices = getRemoteFeatBranches();
  // 添加手动输入选项
  remoteFeatChoices.push({ name: '📝 手动输入', value: 'manual' });

  // 默认选中第一个（最新的）
  const defaultTarget = remoteFeatChoices.length > 1 ? remoteFeatChoices[0].value : null;

  let selectedBranch = await askList('请选择要发布的公共特性分支：', remoteFeatChoices, defaultTarget);

  if (selectedBranch === 'manual') {
    selectedBranch = await askQuestion('请输入公共特性分支 (例如 feat/1.0.0)：');
  }
  selectedBranch = selectedBranch.trim();
  if (!selectedBranch) throw new Error('未选择分支');

  // 2. 检出选中的特性分支以读取版本号和运行检查
  log(`\n🔀 正在检出 ${selectedBranch}...`, 'blue');
  try {
    // 检查本地是否存在
    const localExists = execCommand(`git branch --list ${selectedBranch}`, { silent: true }).trim();
    if (localExists) {
      execCommand(`git checkout ${selectedBranch}`);
      execCommand(`git pull origin ${selectedBranch}`); // 确保最新
    } else {
      execCommand(`git checkout -b ${selectedBranch} origin/${selectedBranch}`);
    }
  } catch (e) {
    throw new Error(`检出分支失败: ${e.message}`);
  }

  // 3. Determine Version
  const pkg = getPackageJson();
  const currentVersion = pkg.version;
  log(`\n当前版本：${currentVersion}`, 'yellow');

  const releaseType = await askList('选择发布类型：', [
    { name: `Patch (补丁) (${semver.inc(currentVersion, 'patch')})`, value: 'patch' },
    { name: `Minor (功能) (${semver.inc(currentVersion, 'minor')})`, value: 'minor' },
    { name: `Major (主版本) (${semver.inc(currentVersion, 'major')})`, value: 'major' },
    { name: '自定义', value: 'custom' },
  ]);

  let nextVersion;
  if (releaseType === 'custom') {
    nextVersion = await askQuestion('请输入自定义版本号：');
  } else {
    nextVersion = semver.inc(currentVersion, releaseType);
  }

  if (!semver.valid(nextVersion)) {
    throw new Error(`无效的版本号：${nextVersion}`);
  }

  const releaseBranchName = `release/v${nextVersion}`;
  
  // Check for conflicting local 'release' branch
  try {
    const hasReleaseBranch = execCommand('git branch --list release', { silent: true }).trim();
    if (hasReleaseBranch) {
      log('\n⚠️  检测到本地存在名为 "release" 的分支。', 'yellow');
      log('这会导致无法创建 "release/v..." 格式的分支 (Git 无法同时拥有名为 "release" 的文件和 "release/" 的目录)。', 'yellow');
      
      const action = await askList('请选择如何处理冲突分支 "release"：', [
        { name: '重命名为 release-backup (推荐)', value: 'rename' },
        { name: '删除 (确保不需要)', value: 'delete' },
        { name: '取消操作', value: 'cancel' }
      ]);

      if (action === 'cancel') {
        process.exit(0);
      } else if (action === 'rename') {
        execCommand('git branch -m release release-backup');
        log('✅ 已重命名为 release-backup', 'green');
      } else if (action === 'delete') {
        execCommand('git branch -D release');
        log('🗑️  已删除 release 分支', 'green');
      }
    }
  } catch (e) {
    // Ignore error if check fails, git checkout -b will catch it later
  }

  // 5. Create Release Branch
  const confirmed = await askConfirm(`基于 ${selectedBranch} 创建分支 ${releaseBranchName} 并推送？`);
  if (!confirmed) process.exit(0);

  log(`\n🌿 正在创建分支 ${releaseBranchName}...`, 'blue');
  try {
    execCommand(`git checkout -b ${releaseBranchName}`);
  } catch (e) {
    throw new Error(`创建分支失败: ${e.message}`);
  }
  
  log(`📤 正在推送 ${releaseBranchName} 到远程...`, 'blue');
  try {
    execCommand(`git push origin ${releaseBranchName}`);
  } catch (e) {
    throw new Error(`推送分支失败: ${e.message}`);
  }

  log(`\n✅ 预发布分支已创建：${releaseBranchName}`, 'green');
  log('下一步：部署到预发布环境 (通常由 CI/CD 自动完成)。', 'gray');
}

module.exports = preRelease;
