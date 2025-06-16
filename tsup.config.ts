import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],     // 入口文件（你的 index.ts 导出一切）
  format: ['esm', 'cjs'],  // 构建两种模块格式
  dts: true,               // 自动生成类型声明文件
  sourcemap: false,
  clean: true,
  target: 'node18',
});