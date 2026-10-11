import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverUrl = `http://localhost:${process.env.PORT ?? 3001}`;

export default defineConfig({
    plugins: [react()],
    server: { port: 5173, proxy: { '/api': serverUrl, '/media': serverUrl } }
});
