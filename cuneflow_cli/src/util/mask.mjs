/**
 * 对 token 做脱敏展示。
 * CLI 任何用户可见输出都不得打印 token 明文。
 */
export function maskToken(token) {
  if (!token || token.length < 12) {
    return "***";
  }
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

export function formatDuration(milliseconds) {
  if (milliseconds <= 0) {
    return "expired";
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}
