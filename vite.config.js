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
        main:       resolve(__dirname, 'index.html'),
        about:      resolve(__dirname, 'about.html'),
        work:       resolve(__dirname, 'work.html'),
        blog:       resolve(__dirname, 'blog.html'),
        blogPost:   resolve(__dirname, 'blog-post.html'),
        links:      resolve(__dirname, 'links.html'),
        uses:       resolve(__dirname, 'uses.html'),
        playground: resolve(__dirname, 'playground.html'),
        jamify:     resolve(__dirname, 'jamify.html'),
        bookACall:  resolve(__dirname, 'book-a-call.html'),
        register:   resolve(__dirname, 'register.html'),
        notFound:         resolve(__dirname, '404.html'),
        adminLogin:       resolve(__dirname, 'admin/login.html'),
        adminDashboard:   resolve(__dirname, 'admin/dashboard.html'),
        adminRegistrations: resolve(__dirname, 'admin/registrations.html'),
      },
      // mobile-perf.js is a legacy (non-module) script served statically
      external: ['/mobile-perf.js'],
    },
  },
});
