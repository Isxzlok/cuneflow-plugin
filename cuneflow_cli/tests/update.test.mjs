import assert from "node:assert/strict";
import test from "node:test";

import { runUpdate } from "../src/commands/update.mjs";

test("已经是最新版时不重复安装", async () => {
  let installCalled = false;

  const result = await runUpdate({
    packageInfo: { name: "@cuneflow/cli", version: "1.2.3" },
    lookupLatestVersion: async () => "1.2.3",
    installLatestVersion: async () => { installCalled = true; }
  });

  assert.equal(result.updated, false);
  assert.equal(installCalled, false);
});

test("有新版本时安装 npm latest", async () => {
  let installedPackage;

  const result = await runUpdate({
    packageInfo: { name: "@cuneflow/cli", version: "1.2.3" },
    lookupLatestVersion: async (packageName) => {
      assert.equal(packageName, "@cuneflow/cli");
      return "1.3.0";
    },
    installLatestVersion: async (packageName) => { installedPackage = packageName; }
  });

  assert.equal(result.updated, true);
  assert.equal(installedPackage, "@cuneflow/cli");
});

test("本地版本更高时不降级", async () => {
  let installCalled = false;

  const result = await runUpdate({
    packageInfo: { name: "@cuneflow/cli", version: "2.0.0" },
    lookupLatestVersion: async () => "1.9.9",
    installLatestVersion: async () => { installCalled = true; }
  });

  assert.equal(result.updated, false);
  assert.equal(installCalled, false);
});

test("npm 查询失败时返回可理解的错误", async () => {
  await assert.rejects(
    runUpdate({
      packageInfo: { name: "@cuneflow/cli", version: "1.0.0" },
      lookupLatestVersion: async () => {
        const error = new Error("command failed");
        error.stderr = "network timeout";
        throw error;
      }
    }),
    /Unable to check.*network timeout/
  );
});
