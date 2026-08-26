#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_FILES = 20;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 120_000;
const SUPPORTED_USER_FILE_EXTENSIONS = new Set([".pdf", ".epub"]);

const MIME_BY_EXTENSION = new Map([
  [".aac", "audio/aac"],
  [".avi", "video/x-msvideo"],
  [".csv", "text/csv"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".epub", "application/epub+zip"],
  [".json", "application/json"],
  [".m4a", "audio/mp4"],
  [".md", "text/markdown"],
  [".mkv", "video/x-matroska"],
  [".mov", "video/quicktime"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".txt", "text/plain"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".zip", "application/zip"]
]);

function normalizeLocalReference(reference) {
  const filePath = reference.startsWith("file://") ? fileURLToPath(reference) : reference;
  if (!path.isAbsolute(filePath)) {
    throw new Error("attachment reference must be an absolute path or file:// URL");
  }
  return path.normalize(filePath);
}

function contentTypeFor(filePath) {
  return MIME_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function displayNameFor(filePath) {
  const rawName = path.basename(filePath);
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

async function md5Base64(filePath) {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("base64");
}

async function inspectOne(reference) {
  const filePath = normalizeLocalReference(reference);
  const extension = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_USER_FILE_EXTENSIONS.has(extension)) {
    throw new Error("CUNEFLOW MCP only supports PDF and EPUB user files");
  }
  const metadata = await lstat(filePath);
  if (metadata.isSymbolicLink()) {
    throw new Error("symbolic links are not accepted");
  }
  if (!metadata.isFile()) {
    throw new Error("attachment reference is not a regular file");
  }
  if (metadata.size <= 0 || metadata.size > MAX_FILE_BYTES) {
    throw new Error(`file size must be between 1 and ${MAX_FILE_BYTES} bytes`);
  }

  return {
    filePath,
    name: displayNameFor(filePath),
    sizeBytes: metadata.size,
    contentType: contentTypeFor(filePath),
    contentMd5: await md5Base64(filePath),
    mtimeMs: metadata.mtimeMs
  };
}

async function inspectAttachments(references) {
  if (references.length < 1 || references.length > MAX_FILES) {
    throw new Error(`expected 1-${MAX_FILES} attachment references`);
  }

  const files = [];
  let totalBytes = 0;
  for (const reference of references) {
    const file = await inspectOne(reference);
    totalBytes += file.sizeBytes;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(`attachments exceed the ${MAX_TOTAL_BYTES} byte total limit`);
    }
    files.push(file);
  }
  return { files, totalBytes };
}

function allowedUploadHost(hostname) {
  const configured = (process.env.CUNEFLOW_UPLOAD_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const allowlist = configured.length > 0 ? configured : [".aliyuncs.com"];
  const normalized = hostname.toLowerCase();
  return allowlist.some((entry) => entry.startsWith(".")
    ? normalized.endsWith(entry) && normalized.length > entry.length
    : normalized === entry);
}

function validateUploadUrl(rawUrl) {
  const url = new URL(rawUrl);
  const localhostException = process.env.CUNEFLOW_UPLOAD_ALLOW_HTTP_LOCALHOST === "1"
    && url.protocol === "http:"
    && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (!localhostException && url.protocol !== "https:") {
    throw new Error("uploadUrl must use HTTPS");
  }
  if (!localhostException && !allowedUploadHost(url.hostname)) {
    throw new Error("uploadUrl host is not allowed");
  }
  return url;
}

function validateHeaders(rawHeaders) {
  if (!rawHeaders || typeof rawHeaders !== "object" || Array.isArray(rawHeaders)) {
    throw new Error("upload headers must be an object");
  }
  const headers = {};
  for (const [name, value] of Object.entries(rawHeaders)) {
    const normalized = name.toLowerCase();
    const allowed = normalized === "content-type"
      || normalized === "content-md5"
      || normalized.startsWith("x-oss-");
    if (!allowed || typeof value !== "string") {
      throw new Error(`upload header is not allowed: ${name}`);
    }
    headers[name] = value;
  }
  return headers;
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    throw new Error("upload plan JSON is required on stdin");
  }
  return JSON.parse(text);
}

async function putAttachment(reference, plan) {
  if (!plan || typeof plan !== "object") {
    throw new Error("upload plan must be an object");
  }
  if (plan.method !== "PUT") {
    throw new Error("only PUT uploads are allowed");
  }
  if (typeof plan.uploadUrl !== "string") {
    throw new Error("uploadUrl is required");
  }

  const file = await inspectOne(reference);
  const expected = plan.expected;
  if (!expected || expected.name !== file.name || expected.sizeBytes !== file.sizeBytes
      || expected.contentMd5 !== file.contentMd5) {
    throw new Error("local attachment changed after the upload session was created");
  }

  const url = validateUploadUrl(plan.uploadUrl);
  const headers = validateHeaders(plan.headers);
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: createReadStream(file.filePath),
    duplex: "half",
    redirect: "manual",
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("upload redirect was rejected");
  }
  if (!response.ok) {
    throw new Error(`attachment upload failed with HTTP ${response.status}`);
  }

  return {
    name: file.name,
    success: true,
    status: response.status,
    bytesSent: file.sizeBytes,
    etag: response.headers.get("etag")
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function usage() {
  return "usage: attachment-helper.mjs inspect <absolute-path>... | put <absolute-path> < upload-plan.json";
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "inspect") {
    printJson(await inspectAttachments(args));
    return;
  }
  if (command === "put" && args.length === 1) {
    printJson(await putAttachment(args[0], await readStdinJson()));
    return;
  }
  throw new Error(usage());
}

main().catch((error) => {
  printJson({ error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
