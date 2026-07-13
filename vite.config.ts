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
        task3: 'task3.html',
        task4: 'task4.html',
        task5: 'task5.html',
        task6: 'task6.html',
        task7: 'task7.html',
        task8: 'task8.html',
        task9: 'task9.html',
        task10: 'task10.html',
      }
    }
  }
});