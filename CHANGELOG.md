# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

## [2.5.0] - 2026-08-24

### Changed

-   Replaced libxmljs2 with libxml2-wasm, moving from libxml2 2.9.9 (2019) to
    2.15.1. libxmljs2 is no longer maintained and no release of it carries a newer
    libxml2, so the library was replaced rather than upgraded.
-   **`?details=true` responses have changed shape.** Error details are now
    `{ line, column }`, where they were the raw libxml2 error struct. See Removed.
-   Schemas are now compiled once at startup rather than re-parsed for every
    activity, so validation of files with schema errors should be faster.

### Added

-   Schema unit tests (`schema-unit-tests`) and tests for file parsing and
    metadata (`utils-unit-tests`). Neither area had any coverage before.
-   A pre-commit hook and CI check that refuse a commit setting
    `"authLevel": "anonymous"` in any `function.json`. That value is only meant to
    be set temporarily, to run the integration tests against the Docker container.

### Fixed

-   Schema validation: sign-only decimals such as `<value> - </value>` are now
    reported; over-long decimals no longer are. This is the divergence with the
    IATI Dashboard reported in
    [#574](https://github.com/IATI/js-validator-api/issues/574).
-   `.env.example`: corrected the dev service hostnames

### Removed

-   `libxmljs2`, and with it the native build dependency — no node-gyp,
    prebuilt binaries or glibc coupling.
-   `str1`, `code`, `level`, `domain` and `int1` from the `details` object
    returned by `?details=true`. `str1` still appears within the error message;
    `level` and `domain` were constant; `str2`, `str3` and `int1` were never
    populated. `code`, the numeric libxml2 constraint identifier, has no
    replacement — libxml2-wasm does not expose it.
