# JACK — FREE 24/7 hosting on Modal (no credit card required).
#
# Runs the Bun server (app + /api/chat LLM proxy) in a Modal container and
# exposes it as an always-on HTTPS web endpoint.
#
# Deploy:
#   modal secret create jack-secrets GROQ_API_KEY=gsk_...        # the brain key
#   modal deploy deploy/modal_app.py
#
# The GROQ key lives only in the Modal secret — never in the image or git.

import subprocess
import modal

app = modal.App("jack-jarvis")

# Build image: install Bun, copy the repo, install deps, build the bundle.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "unzip", "bash")
    .run_commands(
        "curl -fsSL https://bun.sh/install | bash",
        "ln -sf /root/.bun/bin/bun /usr/local/bin/bun",
    )
    .add_local_dir(
        ".",
        "/app",
        copy=True,
        ignore=[".env", ".env.local", ".git", "node_modules", "public/bundle.js",
                "public/bundle.js.map", "*.log", ".claude", "deploy"],
    )
    .run_commands(
        "cd /app && /usr/local/bin/bun install --frozen-lockfile",
        "cd /app && /usr/local/bin/bun run build",
    )
)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("jack-secrets")],
    min_containers=1,          # keep one warm → genuinely 24/7
    timeout=60 * 60,
)
@modal.web_server(8080, startup_timeout=180)
def serve():
    # NODE_ENV=production tells server.ts to skip the file watcher.
    subprocess.Popen(
        "cd /app && NODE_ENV=production /usr/local/bin/bun run server.ts",
        shell=True,
    )
