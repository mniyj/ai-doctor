module.exports = {
  apps: [{
    name: 'ai-doctor',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 8009,
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
  }],
};
