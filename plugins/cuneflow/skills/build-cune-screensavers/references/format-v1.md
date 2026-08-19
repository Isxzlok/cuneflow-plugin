# `.cunesaver` format v1

Version 1 is a draft contract for the SDK and the future SE05 runtime. Confirm device compatibility before declaring the format production-ready.

## Source project

Place `cunesaver.json` at the project root. Required fields:

- `schema_version`: integer `1`.
- `id`: stable lowercase identifier using letters, digits, and hyphens; 1-64 characters.
- `name`: non-empty display name.
- `version`: semantic version such as `1.0.0`.
- `target`: exactly `SE05`.
- `runtime`: exactly `web`.
- `entrypoint`: relative `.html` or `.htm` path.
- `include`: non-empty array of every local file to package, including the entrypoint.

Paths must use `/`, stay below the project root, and must not be symbolic links. `cunesaver.json` and `manifest.json` are reserved and cannot appear in `include`.

## Built package

A `.cunesaver` is a deterministic ZIP archive containing:

- `manifest.json`: canonical UTF-8 JSON derived from `cunesaver.json`.
- Every file named by `include`.

The built manifest removes `include` and adds `files`. Each `files` record contains `path`, byte `size`, and lowercase hexadecimal `sha256`. No undeclared archive entries are allowed.

The ZIP writer uses stable entry order, timestamps, permissions, and JSON serialization so identical source bytes produce identical package bytes.

## Security and runtime assumptions

- Treat packages as untrusted input and always run `validate` before delivery or playback.
- Do not resolve paths outside the archive root.
- Do not allow remote network dependencies in authored screensavers.
- Do not infer successful device import, activation, or playback from a valid ZIP or a successful ADB upload.
