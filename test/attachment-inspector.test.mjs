import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(
  new URL("../plugins/cuneflow/scripts/attachment-inspector.mjs", import.meta.url)
);

function startClient() {
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const pending = new Map();
  const output = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });

  output.on("line", (line) => {
    const message = JSON.parse(line);
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      callback(message);
    }
  });

  let nextId = 1;
  return {
    request(method, params = {}) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`timeout waiting for ${method}`));
        }, 2_000);
        pending.set(id, (message) => {
          clearTimeout(timeout);
          resolve(message);
        });
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    },
    async close() {
      if (child.exitCode !== null) {
        output.close();
        return;
      }
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.stdin.end();
      await exited;
      output.close();
    }
  };
}

test("implements MCP initialization and inspects an exact local attachment", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cuneflow-attachment-p0-"));
  const attachmentPath = path.join(tempDirectory, "meeting notes.txt");
  const contents = Buffer.from("CUNEFLOW attachment P0\n", "utf8");
  await writeFile(attachmentPath, contents);

  const client = startClient();
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" }
    });
    assert.equal(initialized.result.protocolVersion, "2025-11-25");
    assert.equal(initialized.result.serverInfo.name, "cuneflow-local-upload");

    const listed = await client.request("tools/list");
    assert.deepEqual(listed.result.tools.map((tool) => tool.name), ["inspect_local_attachments"]);

    const inspected = await client.request("tools/call", {
      name: "inspect_local_attachments",
      arguments: { paths: [attachmentPath] }
    });
    const result = inspected.result.structuredContent;

    assert.equal(inspected.result.isError, undefined);
    assert.equal(result.phase, "p0_attachment_access");
    assert.equal(result.uploaded, false);
    assert.equal(result.errors.length, 0);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].name, "meeting notes.txt");
    assert.equal(result.files[0].size, contents.length);
    assert.equal(result.files[0].contentType, "text/plain");
    assert.equal(result.files[0].contentMd5, createHash("md5").update(contents).digest("base64"));
    assert.equal(typeof result.files[0].localHandle, "string");
    assert.equal(Object.hasOwn(result.files[0], "path"), false);
  } finally {
    await client.close();
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("rejects relative paths without reading them", async () => {
  const client = startClient();
  try {
    await client.request("initialize", { protocolVersion: "2025-11-25" });
    const inspected = await client.request("tools/call", {
      name: "inspect_local_attachments",
      arguments: { paths: ["meeting.mp4"] }
    });

    assert.equal(inspected.result.isError, true);
    assert.equal(inspected.result.structuredContent.files.length, 0);
    assert.equal(inspected.result.structuredContent.errors[0].code, "attachment_not_readable");
  } finally {
    await client.close();
  }
});

test("decodes an encoded staged attachment name for display", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cuneflow-attachment-name-"));
  const attachmentPath = path.join(tempDirectory, "AI%20Infrastructure%20Cost.pdf");
  await writeFile(attachmentPath, Buffer.from("pdf fixture", "utf8"));

  const client = startClient();
  try {
    await client.request("initialize", { protocolVersion: "2025-11-25" });
    const inspected = await client.request("tools/call", {
      name: "inspect_local_attachments",
      arguments: { paths: [attachmentPath] }
    });

    assert.equal(
      inspected.result.structuredContent.files[0].name,
      "AI Infrastructure Cost.pdf"
    );
  } finally {
    await client.close();
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
