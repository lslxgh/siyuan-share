# SiYuan Share Backend

思源笔记分享插件的后端服务，包含 API 服务和 Web 前端。

## 项目结构

```
backend/
├── api/                 # Go 后端 API
│   ├── main.go
│   ├── models/         # 数据模型
│   ├── controllers/    # 控制器
│   ├── middleware/     # 中间件
│   ├── routes/         # 路由
│   └── README.md
└── web/                # React 前端
    ├── src/
    ├── public/
    └── README.md
```

## 技术栈

### 后端 API
- **Go 1.21+**
- **Gin** - Web 框架
- **GORM** - ORM
- **SQLite** - 数据库（github.com/glebarez/sqlite）

### Web 前端
- **React 18**
- **TypeScript**
- **Vite**
- **React Router**
- **Axios**
- **React Markdown**

## 快速开始

> 💡 推荐使用 [Task](https://taskfile.dev/) 运行项目任务，详见 [TASKFILE_README.md](./TASKFILE_README.md)

### 使用 Task（推荐）

安装 [Task](https://taskfile.dev/)：
```bash
# Windows (Scoop)
scoop install task

# macOS
brew install go-task/tap/go-task

# Linux
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b ~/.local/bin
```

常用命令：
```bash
# 安装所有依赖
task install

# 启动后端开发服务器
task api:dev

# 启动前端开发服务器（另开终端）
task web:dev

# 构建完整应用（前端+后端嵌入）
task build

# 运行构建后的应用
task run

# 查看所有可用任务
task --list
```

### 手动运行

#### 后端 API

```bash
cd api
go mod download
go run main.go
```

默认端口：8080

#### Web 前端

```bash
cd web
npm install  # 或 pnpm install
npm run dev
```

默认端口：3000

## 环境变量

### API 服务

- `PORT` - 服务端口（默认：8080）
- `DATA_DIR` - 数据目录（默认：./data）
- `GIN_MODE` - Gin 模式（release/debug）

### Web 前端

创建 `web/.env.local`：

```
VITE_API_URL=http://localhost:8080
```

## API 接口文档

详见 [api/README.md](./api/README.md)

## 部署

### 开发环境

1. 启动后端 API：
```bash
cd api && go run main.go
```

2. 启动前端开发服务器：
```bash
cd web && npm run dev
```

### 生产环境（嵌入式部署）

后端已集成前端静态文件，只需构建一个可执行文件：

**使用 Task（推荐）：**
```bash
# 一键构建
task build

# 运行
cd api
./siyuan-share-api  # Linux/macOS
# 或
.\siyuan-share-api.exe  # Windows
```

**手动构建：**
```bash
# 1. 构建前端
cd web
npm install
npm run build

# 2. 构建后端（会自动嵌入 web/dist）
cd ../api
go build -o siyuan-share-api  # Linux/macOS
# 或
go build -o siyuan-share-api.exe  # Windows

# 3. 运行
./siyuan-share-api  # 访问 http://localhost:8080
```

**注意**：
- 前端文件通过 Go embed 嵌入到二进制文件中
- 确保在构建后端前先构建前端（web/dist 目录必须存在）
- 前端会自动使用相对路径访问 API，无需额外配置

### 生产环境（分离部署）

如需前后端分离部署，使用 Nginx 等反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /path/to/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 分享查看代理
    location /s {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 数据库

使用 SQLite 存储数据，数据库文件位于 `api/data/siyuan-share.db`。

### 表结构

#### shares 表
- 分享记录
- 包含文档内容、密码、过期时间等

#### users 表
- 用户信息
- API Token 认证

详见：[api/models/](./api/models/)

## 开发说明

### 初始化数据库

首次运行 API 服务时会自动创建数据库表结构。

### 创建测试用户

可以直接在数据库中插入用户记录，或通过代码创建：

```go
user := &models.User{
    ID:       "test-user-id",
    Username: "testuser",
    Email:    "test@example.com",
    APIToken: "your-api-token",
    IsActive: true,
}
models.DB.Create(user)
```

### 前后端联调

开发时前端使用 Vite 代理到后端 API，确保两个服务都在运行。

## License

MIT
