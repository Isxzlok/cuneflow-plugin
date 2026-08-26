import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(
  new URL("../plugins/cuneflow/scripts/attachment-helper.mjs", import.meta.url)
);

function runHelper(args, { input = "", env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [helperPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => resolve({
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
    child.stdin.end(input);
  });
}

test("inspects exact local attachments for a remote upload session", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cuneflow-attachment-"));
  const attachmentPath = path.join(tempDirectory, "meeting notes.epub");
  const contents = Buffer.from("CUNEFLOW attachment\n", "utf8");
  await writeFile(attachmentPath, contents);

  try {
    const result = await runHelper(["inspect", attachmentPath]);
    assert.equal(result.code, 0);
    const inspected = JSON.parse(result.stdout);
    assert.equal(inspected.files.length, 1);
    assert.equal(inspected.files[0].filePath, attachmentPath);
    assert.equal(inspected.files[0].name, "meeting notes.epub");
    assert.equal(inspected.files[0].sizeBytes, contents.length);
    assert.equal(inspected.files[0].contentType, "application/epub+zip");
    assert.equal(inspected.files[0].contentMd5, createHash("md5").update(contents).digest("base64"));
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("rejects relative attachment paths", async () => {
  const result = await runHelper(["inspect", "meeting.pdf"]);
  assert.equal(result.code, 1);
  assert.match(JSON.parse(result.stdout).error, /absolute path/);
});

test("rejects user file formats other than PDF and EPUB", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cuneflow-attachment-format-"));
  const attachmentPath = path.join(tempDirectory, "meeting.txt");
  await writeFile(attachmentPath, "notes", "utf8");

  try {
    const result = await runHelper(["inspect", attachmentPath]);
    assert.equal(result.code, 1);
    assert.match(JSON.parse(result.stdout).error, /PDF and EPUB/);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("decodes an encoded staged attachment name", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cuneflow-attachment-name-"));
  const attachmentPath = path.join(tempDirectory, "AI%20Infrastructure%20Cost.pdf");
  await writeFile(attachmentPath, Buffer.from("pdf fixture", "utf8"));

  try {
    const result = await runHelper(["inspect", attachmentPath]);
    assert.equal(JSON.parse(result.stdout).files[0].name, "AI Infrastructure Cost.pdf");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("streams a verified attachment to a presigned PUT target", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cuneflow-attachment-put-"));
  const attachmentPath = path.join(tempDirectory, "meeting.pdf");
  const contents = Buffer.from("upload body", "utf8");
  await writeFile(attachmentPath, contents);

  let received;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = Buffer.concat(chunks);
    response.writeHead(200, { etag: "test-etag" });
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  try {
    const contentMd5 = createHash("md5").update(contents).digest("base64");
    const plan = {
      uploadUrl: `http://127.0.0.1:${address.port}/upload`,
      method: "PUT",
      headers: { "Content-Type": "application/pdf", "Content-MD5": contentMd5 },
      expected: { name: "meeting.pdf", sizeBytes: contents.length, contentMd5 }
    };
    const result = await runHelper(["put", attachmentPath], {
      input: JSON.stringify(plan),
      env: { CUNEFLOW_UPLOAD_ALLOW_HTTP_LOCALHOST: "1" }
    });
    assert.equal(result.code, 0);
    assert.deepEqual(received, contents);
    assert.deepEqual(JSON.parse(result.stdout), {
      name: "meeting.pdf",
      success: true,
      status: 200,
      bytesSent: contents.length,
      etag: "test-etag"
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("rejects non-HTTPS and unauthorized upload headers", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cuneflow-attachment-safety-"));
  const attachmentPath = path.join(tempDirectory, "meeting.pdf");
  const contents = Buffer.from("upload body", "utf8");
  await writeFile(attachmentPath, contents);
  const expected = {
    name: "meeting.pdf",
    sizeBytes: contents.length,
    contentMd5: createHash("md5").update(contents).digest("base64")
  };

  try {
    const insecure = await runHelper(["put", attachmentPath], {
      input: JSON.stringify({ uploadUrl: "http://example.com/upload", method: "PUT", headers: {}, expected })
    });
    assert.equal(insecure.code, 1);
    assert.match(JSON.parse(insecure.stdout).error, /HTTPS/);

    const forbiddenHeader = await runHelper(["put", attachmentPath], {
      input: JSON.stringify({
        uploadUrl: "https://bucket.oss-us-east-1.aliyuncs.com/upload",
        method: "PUT",
        headers: { Authorization: "secret" },
        expected
      })
    });
    assert.equal(forbiddenHeader.code, 1);
    assert.match(JSON.parse(forbiddenHeader.stdout).error, /header is not allowed/);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
