import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      css: {
        devSourcemap: false,
      },
      build: {
        sourcemap: false,
      },
      plugins: [
        react(),
        tailwindcss(),
        {
          name: 'strip-quill-sourcemap',
          enforce: 'pre',
          load(id) {
            if (id.includes('quill.snow.css') || id.includes('quill.bubble.css') || id.includes('quill.core.css')) {
              const content = fs.readFileSync(id.split('?')[0], 'utf-8');
              return {
                code: content.replace(/\/\*# sourceMappingURL=.*?\*\//g, ''),
                map: { mappings: '' },
              };
            }
          },
          transform(code, id) {
            if (id.includes('.css')) {
              return {
                code: code.replace(/\/\*# sourceMappingURL=.*?\*\//g, ''),
                map: { mappings: '' },
              };
            }
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
