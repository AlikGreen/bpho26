import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bpho26/',
  build:
  {
    rollupOptions:
    {
      input:
      {
        main: 'index.html',
        task6: 'task6.html'
      }
    }
  }
});