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
        task6: 'task6.html',
        task4: 'task4.html',
        task8: 'task8.html'
      }
    }
  }
});