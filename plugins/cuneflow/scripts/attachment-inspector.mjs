#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "cuneflow-local-upload";
const SERVER_VERSION = "0.1.0";
const LATEST_PROTOCOL_VERSION = "2025-11-25";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  LATEST_PROTOCOL_VERSION,
  "2025-06-18",
  "2024-11-05"
]);
const MAX_FILES = 20;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

const handles = new Map();

const MIME_BY_EXTENSION = new Map([
  [".aac", "audio/aac"],
  [".avi", "video/x-msvideo"],
  [".csv", "text/csv"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".json", "application/json"],
  [".m4a", "audio/mp4"],
  [".mkv", "video/x-matroska"],
  [".mov", "video/quicktime"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".txt", "text/plain"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".zip", "application/zip"]
]);

const INSPECT_TOOL = {
  name: "inspect_local_attachments",
  title: "Inspect local CUNEFLOW upload attachments",
  description:
    "P0 validation tool. Reads only the exact local files supplied by Codex and returns upload metadata without returning file contents or uploading anything.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      paths: {
        type: "array",
        minItems: 1,
        maxItems: MAX_FILES,
        items: { type: "string", minLength: 1 },
        description: "Absolute local paths or file:// references for attachments in the current Codex request."
      }
    },
    required: ["paths"]
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function protocolError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function toolResult(value, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
    ...(isError ? { isError: true } : {})
  };
}

function normalizeLocalReference(reference) {
  if (reference.startsWith("file://")) {
    return fileURLToPath(reference);
  }
  if (!path.isAbsolute(reference)) {
    throw new Error("attachment reference must be an absolute path or file:// URL");
  }
  return path.normalize(reference);
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
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("base64");
}

async function inspectOne(reference) {
  const filePath = normalizeLocalReference(reference);
  const metadata = await lstat(filePath);

  if (metadata.isSymbolicLink()) {
    throw new Error("symbolic links are not accepted");
  }
  if (!metadata.isFile()) {
    throw new Error("attachment reference is not a regular file");
  }
  if (metadata.size > MAX_FILE_BYTES) {
    throw new Error(`file exceeds the P0 limit of ${MAX_FILE_BYTES} bytes`);
  }

  const contentMd5 = await md5Base64(filePath);
  const localHandle = randomUUID();
  handles.set(localHandle, {
    filePath,
    size: metadata.size,
    mtimeMs: metadata.mtimeMs,
    dev: metadata.dev,
    ino: metadata.ino
  });

  return {
    localHandle,
    name: displayNameFor(filePath),
    size: metadata.size,
    contentType: contentTypeFor(filePath),
    contentMd5,
    readable: true
  };
}

async function inspectAttachments(args) {
  if (!args || !Array.isArray(args.paths) || args.paths.length === 0) {
    return toolResult({ code: "invalid_arguments", message: "paths must contain at least one attachment reference" }, true);
  }
  if (args.paths.length > MAX_FILES || args.paths.some((item) => typeof item !== "string" || item.length === 0)) {
    return toolResult({ code: "invalid_arguments", message: `paths must contain 1-${MAX_FILES} non-empty strings` }, true);
  }

  const files = [];
  const errors = [];
  for (let index = 0; index < args.paths.length; index += 1) {
    try {
      files.push(await inspectOne(args.paths[index]));
    } catch (error) {
      errors.push({
        index,
        code: "attachment_not_readable",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return toolResult({
    phase: "p0_attachment_access",
    uploaded: false,
    files,
    errors
  }, files.length === 0);
}

async function handleRequest(request) {
  const { id, method, params } = request;

  if (method === "initialize") {
    const requestedVersion = params?.protocolVersion;
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion)
          ? requestedVersion
          : LATEST_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          "P0 only: inspect exact Codex attachment references. This server does not upload files or create CUNEFLOW records."
      }
    };
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: [INSPECT_TOOL] } };
  }

  if (method === "tools/call") {
    if (params?.name !== INSPECT_TOOL.name) {
      return protocolError(id, -32602, `unknown tool: ${String(params?.name)}`);
    }
    return { jsonrpc: "2.0", id, result: await inspectAttachments(params.arguments) };
  }

  return protocolError(id, -32601, `method not found: ${String(method)}`);
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of input) {
  if (line.trim().length === 0) {
    continue;
  }

  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    writeMessage(protocolError(null, -32700, "parse error"));
    continue;
  }

  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    writeMessage(protocolError(request.id, -32600, "invalid request"));
    continue;
  }

  if (request.id === undefined) {
    continue;
  }

  try {
    writeMessage(await handleRequest(request));
  } catch (error) {
    writeMessage(protocolError(
      request.id,
      -32603,
      "internal error",
      error instanceof Error ? error.message : String(error)
    ));
  }
}
