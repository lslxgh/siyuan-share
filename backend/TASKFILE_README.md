# Task 任务文件

本项目使用 [Task](https://taskfile.dev/) 作为任务运行器，替代传统的 Makefile 和 shell 脚本。

## 安装 Task

### Windows
```powershell
# 使用 Scoop
scoop install task

# 使用 Chocolatey
choco install go-task
```

### macOS
```bash
brew install go-task/tap/go-task
```

### Linux
```bash
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b ~/.local/bin
```

## 可用任务

查看所有可用任务：
```bash
task --list
```

### 开发任务

- `task install` - 安装所有依赖（前端+后端）
- `task api:dev` - 启动后端开发服务器（端口 8080）
- `task web:dev` - 启动前端开发服务器（端口 3000）
- `task fmt` - 格式化代码
- `task test` - 运行测试

### 构建任务

- `task build` - 构建完整应用（前端构建后嵌入到后端）
- `task web:build` - 仅构建前端
- `task api:build` - 仅构建后端（依赖前端构建）
- `task release` - 构建发布版本（带版本信息）

### 运行任务

- `task run` - 构建并运行应用
- `task api:run` - 运行已构建的后端可执行文件
- `task web:preview` - 预览前端构建结果

### 清理任务

- `task clean` - 清理所有构建产物
- `task web:clean` - 清理前端构建产物
- `task api:clean` - 清理后端构建产物和数据库
- `task db:reset` - 重置数据库（删除所有数据）

## 开发工作流

### 日常开发

1. 安装依赖（首次或依赖更新后）：
   ```bash
   task install
   ```

2. 启动后端（终端 1）：
   ```bash
   task api:dev
   ```

3. 启动前端（终端 2）：
   ```bash
   task web:dev
   ```

4. 访问 http://localhost:3000 进行开发

### 生产构建

1. 构建完整应用：
   ```bash
   task build
   ```

2. 运行应用：
   ```bash
   task api:run
   ```

3. 访问 http://localhost:8080

### 发布版本

构建带版本信息的发布版：
```bash
task release
```

版本号会自动从 git tag 获取，或使用 "dev" 作为默认值。

## 任务特性

### 增量构建

Task 支持增量构建，只有当源文件改变时才会重新构建：

```yaml
sources:
  - 'web/src/**/*'
generates:
  - 'web/dist/index.html'
```

### 依赖管理

任务可以声明依赖，自动按顺序执行：

```bash
# api:build 会自动先执行 web:build
task api:build
```

### 跨平台支持

使用 `platforms` 字段，任务可以根据操作系统执行不同命令：

```yaml
- cmd: go build -o binary.exe
  platforms: [windows]
- cmd: go build -o binary
  platforms: [linux, darwin]
```

## 优势

相比传统的 shell 脚本：

1. **跨平台** - 在 Windows/Linux/macOS 上都能运行
2. **声明式** - YAML 配置更清晰易读
3. **增量构建** - 自动检测文件变化，避免重复构建
4. **依赖管理** - 自动解析任务依赖关系
5. **并行执行** - 支持并行运行独立任务
6. **更好的错误处理** - 自动停止失败的任务链

## 更多信息

- [Task 官方文档](https://taskfile.dev/)
- [Task GitHub](https://github.com/go-task/task)
