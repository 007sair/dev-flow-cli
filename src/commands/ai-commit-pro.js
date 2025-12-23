const { 
  log, 
  execCommand, 
  select, 
  text, 
  handleCancel, 
  checkAiConfigured,
  note,
  spinner
} = require('../utils');
const chalk = require('chalk');

/**
 * 统一的 AI 提交交互流程
 * @returns {Promise<string>} 'copied' | 'committed' | 'manual' | 'error' | null
 */
async function aiCommitPro() {
  // 0. Check for changes
  try {
    const status = (await execCommand('git status --porcelain', { silent: true }));
    if (!status.trim()) {
      log.error('❌ 没有检测到变更，请先修改文件并保存。');
      return null;
    }
  } catch (e) {
    // ignore
  }

  // 1. Check if AI is configured
  if (!checkAiConfigured()) {
    return null;
  }

  // 2. Select Mode
  const mode = await select({
    message: '请选择 AI 生成模式',
    options: [
      { label: '生成并复制', value: 'copy', hint: '推荐 - 生成后可粘贴修改' },
      { label: '生成并提交', value: 'commit', hint: '交互式提交' },
      { label: '手动输入', value: 'manual', hint: '跳过 AI' }
    ],
    initialValue: 'copy'
  });
  handleCancel(mode);

  if (mode === 'manual') {
    return 'manual';
  }

  // 2.1 Ask for --all (Stage all changes)
  // Check if there are unstaged changes? 
  // Git status --porcelain shows ' M' for unstaged modified, '??' for untracked.
  // 'M ' is staged.
  // If we have unstaged changes, we should ask.
  let useAll = false;
  try {
    const statusOutput = await execCommand('git status --porcelain', { silent: true });
    // Check for unstaged changes (lines starting with space or ??)
    const hasUnstaged = statusOutput.split('\n').some(line => line.match(/^( | \?|\?)/));
    
    if (hasUnstaged) {
      const confirmAll = await select({
        message: '检测到未暂存的变更，是否连同一起提交 (git add -A)?',
        options: [
          { label: '是 (自动暂存所有变更)', value: true },
          { label: '否 (仅使用当前暂存区)', value: false }
        ],
        initialValue: true
      });
      handleCancel(confirmAll);
      useAll = confirmAll;
    }
  } catch (e) {
    // ignore
  }

  const allFlag = useAll ? ' --all' : '';

  try {
    if (mode === 'copy') {
      // 3. Ask for number of messages (Default 1)
      const countStr = await text({
        message: '生成条数 (默认 1，多条会消耗更多 Token)',
        defaultValue: '1',
        placeholder: '1'
      });
      handleCancel(countStr);
      
      const count = parseInt(countStr) || 1;
      
      // Run aicommits with copy option
      try {
        await execCommand(`aicommits -c -g ${count}${allFlag}`, { stdio: 'inherit' });
      } catch(e) {
        return 'error';
      }
      
      log.message('如果已选中消息，则已复制到剪贴板。\n可在下方直接粘贴 (Cmd+V)', '📋 操作结束');
      return 'copied';
    } 
    else if (mode === 'commit') {
      // Standard interactive mode
      await execCommand(`aicommits${allFlag}`, { stdio: 'inherit' });
      return 'committed';
    }
  } catch (e) {
    log.error('\n❌ AI 生成过程中止或失败。');
    return 'error';
  }
}

module.exports = aiCommitPro;
