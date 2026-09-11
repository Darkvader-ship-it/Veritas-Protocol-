module.exports = {
  apps: [
    {
      name: 'copy-trading-simulator',
      script: 'simulator.ts',
      interpreter: 'node',
      interpreter_args: '--require ts-node/register',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/simulator-error.log',
      out_file: './logs/simulator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    {
      name: 'auto-resolver',
      script: 'auto-resolver.js',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        FRONTEND_URL: 'http://localhost:3000',
        RESOLVE_INTERVAL_MS: '60000', // 1 minute
      },
      error_file: './logs/resolver-error.log',
      out_file: './logs/resolver-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    }
  ]
};
