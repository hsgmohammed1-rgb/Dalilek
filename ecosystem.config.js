module.exports = {
  apps : [{
    name   : "dalilek-server",
    script : "./server.js",
    instances: "1", // Run one instance, change to 'max' for load balancing
    exec_mode: "fork",
    watch  : false, // Don't auto-restart on file changes in production
    max_memory_restart: "1G",
    restart_delay: 2000,
    max_restarts: 15,
    env: {
      NODE_ENV: "production"
    }
  }]
}
