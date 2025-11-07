# SiYuan Share API

思源笔记分享插件的后端 API 服务。

## 技术栈

- **Go 1.21+**
- **Gin** - Web 框架
- **GORM** - ORM 框架
- **SQLite** - 数据库（使用 github.com/glebarez/sqlite 驱动）

## 快速开始

### 安装依赖

```bash
go mod download
```

### 创建用户

首次使用需要创建用户和 API Token：

```bash
go run tools/create_user.go -username testuser -email test@example.com
```

将输出用户信息和 API Token，请妥善保存 API Token 用于插件配置。

### 运行服务

```bash
go run main.go
```

默认监听端口：8080

### 环境变量

- `PORT` - 服务端口（默认：8080）
- `DATA_DIR` - 数据目录（默认：./data）
- `GIN_MODE` - Gin 模式（release/debug）

## API 接口

### 认证

所有需要认证的接口需要在请求头中携带：

```
Authorization: Bearer <API_TOKEN>
```

### 分享管理接口

#### 创建分享

```
POST /api/share/create
```

请求体：

```json
{
  "docId": "文档ID",
  "docTitle": "文档标题",
  "content": "文档内容（Markdown）",
  "requirePassword": false,
  "password": "访问密码（可选）",
  "expireDays": 7,
  "isPublic": true
}
```

响应：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "shareId": "分享ID",
    "shareUrl": "分享链接"
  }
}
```

#### 获取分享列表

```
GET /api/share/list
```

响应：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "shares": [...]
  }
}
```

#### 删除分享

```
DELETE /api/share/:id
```

### 公开访问接口

#### 查看分享

```
GET /s/:id?password=xxx
```

响应：

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "分享ID",
    "docTitle": "文档标题",
    "content": "文档内容",
    "requirePassword": false,
    "expireAt": "过期时间",
    "viewCount": 浏览次数,
    "createdAt": "创建时间"
  }
}
```

## 数据库结构

### shares 表

- `id` - 分享ID（主键）
- `user_id` - 用户ID
- `doc_id` - 文档ID
- `doc_title` - 文档标题
- `content` - 文档内容
- `require_password` - 是否需要密码
- `password_hash` - 密码哈希
- `expire_at` - 过期时间
- `is_public` - 是否公开
- `view_count` - 浏览次数
- `created_at` - 创建时间
- `updated_at` - 更新时间
- `deleted_at` - 软删除时间

### users 表

- `id` - 用户ID（主键）
- `username` - 用户名
- `email` - 邮箱
- `api_token` - API Token
- `is_active` - 是否激活
- `created_at` - 创建时间
- `updated_at` - 更新时间
- `deleted_at` - 软删除时间

## 开发说明

### 项目结构

```
api/
├── main.go              # 入口文件
├── models/              # 数据模型
│   ├── database.go      # 数据库初始化
│   ├── share.go         # 分享模型
│   └── user.go          # 用户模型
├── controllers/         # 控制器
│   ├── share.go         # 分享管理
│   └── view.go          # 分享查看
├── middleware/          # 中间件
│   ├── auth.go          # 认证中间件
│   └── cors.go          # CORS 中间件
└── routes/              # 路由
    └── routes.go        # 路由配置
```

## 部署

### 构建

```bash
go build -o siyuan-share-api
```

### 运行

```bash
./siyuan-share-api
```

## License

MIT
