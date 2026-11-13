import http from "node:http";
import { syncBuiltinESMExports } from "node:module";

// Next's generated standalone entry creates its HTTP server internally and
// exposes keepAliveTimeout, but not requestTimeout. Preload this before server.js
// so a 200 MB upload on a slow connection isn't cut off at Node's five-minute
// default. Keep the shorter header timeout and all existing server options.
const createServer = http.createServer;
http.createServer = function (...args) {
  const server = Reflect.apply(createServer, this, args);
  server.requestTimeout = 30 * 60 * 1000;
  return server;
};
syncBuiltinESMExports();
