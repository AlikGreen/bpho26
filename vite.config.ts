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
        task1: 'task1.html',
        task4: 'task4.html',
        task6: 'task6.html',
        task8: 'task8.html',
        task9: 'task9.html',
      }
    }
  }
});