// Stub for the native libsql module.
// Used on Vercel serverless where native Rust addons cannot compile.
// At runtime, @libsql/client uses the pure-JS HTTP/WebSocket client
// (via @libsql/hrana-client) for remote libsql:// connections,
// so this stub is never actually called.
module.exports = {}
