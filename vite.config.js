import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Clean-URL rewrite plugin for dev server.
 * Mirrors the Express cleanRoutes map from server.js so that
 * paths like /dashboard resolve to user-dashboard.html during development.
 */
function cleanUrlPlugin() {
  const rewrites = {
    '/about':             '/about.html',
    '/schedule':          '/schedule.html',
    '/problem-statement': '/problem-statement.html',
    '/ps':                '/problem-statement.html',
    '/winners':           '/winners.html',
    '/sponsors':          '/sponsors.html',
    '/code-of-conduct':   '/code-of-conduct.html',
    '/our-team':          '/our-team.html',
    '/register':          '/register.html',
    '/dashboard':         '/user-dashboard.html',
    '/contact':           '/contact.html',
    '/legal':             '/legal.html',
    '/admin/login':           '/admin/login.html',
    '/admin/dashboard':       '/admin/dashboard.html',
    '/admin/registrations':   '/admin/registrations.html',
    '/admin/submissions':     '/admin/submissions.html',
    '/admin/problem-statements': '/admin/problem-statements.html',
    '/admin/payments':        '/admin/payments.html',
    '/admin/ps-stats':        '/admin/ps-stats.html',
    '/admin/winners':         '/admin/winners.html',
  };

  return {
    name: 'clean-url-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && rewrites[req.url]) {
          req.url = rewrites[req.url];
        }
        next();
      });
    },
  };
}

export default defineConfig({
  // Multi-page app — lets Vite resolve /404 to 404.html
  appType: 'mpa',

  plugins: [cleanUrlPlugin()],

  // Development server configuration
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  build: {
    rollupOptions: {
      input: {
        // Core Pages
        main:               resolve(__dirname, 'index.html'),
        about:              resolve(__dirname, 'about.html'),
        notFound:           resolve(__dirname, '404.html'),
        
        // UDBHAV'26 Public Pages
        register:           resolve(__dirname, 'register.html'),
        schedule:           resolve(__dirname, 'schedule.html'),
        winners:            resolve(__dirname, 'winners.html'),
        sponsors:           resolve(__dirname, 'sponsors.html'),
        ourTeam:            resolve(__dirname, 'our-team.html'),
        codeOfConduct:      resolve(__dirname, 'code-of-conduct.html'),
        problemStatement:   resolve(__dirname, 'problem-statement.html'),
        userDashboard:      resolve(__dirname, 'user-dashboard.html'),
        contact:            resolve(__dirname, 'contact.html'),
        paymentStatus:      resolve(__dirname, 'payment-status.html'),
        
        // Legal
        legal:              resolve(__dirname, 'legal.html'),

        // Admin Dashboard Pages (Nested)
        adminLogin:         resolve(__dirname, 'admin/login.html'),
        adminDashboard:     resolve(__dirname, 'admin/dashboard.html'),
        adminRegistrations: resolve(__dirname, 'admin/registrations.html'),
        adminSubmissions:   resolve(__dirname, 'admin/submissions.html'),
        adminPS:            resolve(__dirname, 'admin/problem-statements.html'),
        adminPayments:      resolve(__dirname, 'admin/payments.html'),
        adminPSStats:       resolve(__dirname, 'admin/ps-stats.html'),
        adminWinners:       resolve(__dirname, 'admin/winners.html'),
        adminTeams:         resolve(__dirname, 'admin/teams.html'),
      },
      // mobile-perf.js is a legacy (non-module) script served statically
      external: ['/mobile-perf.js'],
    },
  },
});