import path from 'path';
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
          transform(code, id) {
            if (id.includes('react-quill-new/dist/quill.snow.css')) {
              return {
                code: code.replace(/\/\*# sourceMappingURL=.* \*\//g, ''),
                map: null,
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
