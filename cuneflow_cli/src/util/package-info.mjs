import fs from "node:fs/promises";

let packageInfoPromise;

/**
 * 从 npm 发布清单读取 CLI 包信息，避免 CLI、proxy 和 doctor 分别硬编码版本号。
 */
export function readPackageInfo() {
  if (!packageInfoPromise) {
    const packageJsonUrl = new URL("../../package.json", import.meta.url);
    packageInfoPromise = fs.readFile(packageJsonUrl, "utf8").then(JSON.parse);
  }
  return packageInfoPromise;
}
