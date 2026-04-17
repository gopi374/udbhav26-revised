import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Multi-page app — lets Vite resolve /404 to 404.html
  appType: 'mpa',

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
        contact:            resolve(__dirname, 'contact.html'),
        teamDashboard:      resolve(__dirname, 'team-dashboard.html'),
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
      },
      // mobile-perf.js is a legacy (non-module) script served statically
      external: ['/mobile-perf.js'],
    },
  },
});