module.exports = {
  apps: [
    {
      name: "pocket-tanks",
      cwd: "/home/bortus/pocket-tanks/server",
      script: "npm",
      args: "start",
      env: { PORT: "5101" },
      autorestart: true,
    },
    {
      name: "pocket-tanks-tunnel",
      cwd: "/home/bortus/pocket-tanks",
      script: "/usr/local/bin/cloudflared",
      args: "tunnel --config /dev/null --no-autoupdate --url http://127.0.0.1:5101",
      autorestart: true,
    },
  ],
};
