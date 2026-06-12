// NORDHEM teaching tutor server.
//
// Bridges the teaching HTML pages to the local Claude Code CLI so tutor
// questions bill Antonio's Claude subscription instead of API credits.
// The browser cannot talk to the subscription directly; this server can,
// because it spawns the same `claude` binary this machine is logged into.
//
// Run from the repo root:   pnpm tutor
// Then open any teaching/*.html page; the tutor panel finds it on :8765.
//
// Endpoints:
//   GET  /health  -> { ok: true }
//   POST /tutor   -> { model, system, messages: [{role, content}] } -> { text }

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.TUTOR_PORT ?? 8765);
const TIMEOUT_MS = 180_000;
const MODELS = new Set(["opus", "sonnet", "haiku"]);

function resolveClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === "win32" && process.env.APPDATA) {
    // npm global install on Windows: PATH only has .ps1/.cmd shims, which
    // Node cannot spawn without a shell. Use the real exe behind the shim.
    const exe = join(
      process.env.APPDATA,
      "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe",
    );
    if (existsSync(exe)) return exe;
  }
  return "claude";
}

const CLAUDE_BIN = resolveClaudeBin();

// The page keeps the chat thread; the server is stateless. Each request
// serializes the whole thread into one prompt so `claude -p` needs no
// session state.
function buildPrompt(messages) {
  const lines = ["This is an ongoing tutoring chat. The conversation so far:", ""];
  for (const m of messages) {
    lines.push((m.role === "assistant" ? "Tutor: " : "Student: ") + m.content, "");
  }
  lines.push("Reply to the student's latest message, as the tutor.");
  return lines.join("\n");
}

function askClaude({ model, system, messages }) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format", "json",
      "--model", model,
      "--system-prompt", system,
      "--tools", "", // pure chat: no tool use, no agentic loop
    ];
    const child = spawn(CLAUDE_BIN, args, { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("claude timed out after " + TIMEOUT_MS / 1000 + "s"));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error("could not start claude (" + CLAUDE_BIN + "): " + err.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error("claude exited " + code + ": " + (stderr || stdout).slice(0, 500)));
      }
      try {
        const data = JSON.parse(stdout);
        if (data.is_error) return reject(new Error("claude error: " + String(data.result).slice(0, 500)));
        resolve(String(data.result ?? "").trim());
      } catch {
        // --output-format json should always be JSON; fall back to raw text.
        resolve(stdout.trim());
      }
    });

    child.stdin.end(buildPrompt(messages));
  });
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*", // teaching pages open from file://
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/tutor") return send(res, 404, { error: "not found" });

  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", async () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: "invalid JSON body" });
    }
    const model = MODELS.has(body.model) ? body.model : "opus";
    if (!Array.isArray(body.messages) || body.messages.length === 0 || typeof body.system !== "string") {
      return send(res, 400, { error: "expected { model, system, messages: [{role, content}] }" });
    }
    const started = Date.now();
    try {
      const text = await askClaude({ model, system: body.system, messages: body.messages });
      console.log(`[tutor] ${model} answered in ${((Date.now() - started) / 1000).toFixed(1)}s (${text.length} chars)`);
      send(res, 200, { text });
    } catch (err) {
      console.error(`[tutor] FAILED after ${((Date.now() - started) / 1000).toFixed(1)}s: ${err.message}`);
      send(res, 502, { error: err.message });
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`NORDHEM tutor server on http://127.0.0.1:${PORT}`);
  console.log(`Using claude binary: ${CLAUDE_BIN}`);
  console.log("Answers bill the Claude subscription this machine is logged into. Ctrl+C to stop.");
});
