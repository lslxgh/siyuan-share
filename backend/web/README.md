# SiYuan Share Web

思源笔记分享插件的 Web 前端应用。

## 技术栈

- **React 18**
- **TypeScript**
- **Vite**
- **React Router**
- **Axios**
- **React Markdown**

## 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 开发模式

```bash
npm run dev
```

访问：http://localhost:3000

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

### 预览生产构建

```bash
npm run preview
```

## 项目结构

```
web/
├── src/
│   ├── api/             # API 接口
│   │   ├── index.ts     # Axios 配置
│   │   └── share.ts     # 分享相关接口
│   ├── pages/           # 页面组件
│   │   ├── ShareView.tsx      # 分享查看页面
│   │   ├── ShareView.css
│   │   ├── NotFound.tsx       # 404 页面
│   │   └── NotFound.css
│   ├── App.tsx          # 主应用组件
│   ├── App.css
│   ├── main.tsx         # 入口文件
│   └── index.css        # 全局样式
├── index.html           # HTML 模板
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
└── package.json
```

## 功能特性

### 分享查看页面

- ✅ Markdown 内容渲染
- ✅ 代码高亮显示
- ✅ 密码保护验证
- ✅ 过期时间显示
- ✅ 浏览次数统计
- ✅ 响应式设计
- ✅ 深色模式支持

### 路由配置

- `/s/:shareId` - 分享查看页面
- `*` - 404 页面

## 环境变量

创建 `.env.local` 文件：

```
VITE_API_URL=http://localhost:8080
```

## 开发说明

### 代理配置

开发环境下，Vite 会将 `/api` 和 `/s` 路径的请求代理到后端 API（默认 `http://localhost:8080`）。

### 代码规范

```bash
npm run lint
```

## 部署

### 使用 Nginx

1. 构建项目：

```bash
npm run build
```

2. 将 `dist` 目录部署到 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /s {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## License

MIT
