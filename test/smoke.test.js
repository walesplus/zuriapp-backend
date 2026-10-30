
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");

let server;
let baseUrl;

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();

    listener.listen(0, "127.0.0.1", () => {
      const { port } = listener.address();
      listener.close(() => resolve(port));
    });

    listener.on("error", reject);
  });
}

before(async () => {
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;

  server = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let startupError = "";
  server.on("error", (error) => {
  startupError += ` Spawn error: ${error.message}`;
});

  server.stderr.on("data", (data) => {
    startupError += data.toString();
  });

  server.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(
        `Backend exited with code ${server.exitCode}: ${startupError}`
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);

      if (response.ok) {
        return;
      }

      startupError = `Health endpoint returned HTTP ${response.status}`;
    } catch {
      // Server may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `Backend failed to become ready: ${startupError}`
  );
});

after(() => {
  if (server && server.exitCode === null) {
    server.kill();
  }
});

test("health endpoint returns HTTP 200", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(data, { status: "ok" });
});

test("products endpoint returns product data", async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.length > 0);
});
