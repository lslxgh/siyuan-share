package main

import (
	"embed"
	"log"
	"os"
	"time"

	"github.com/ZeroHawkeye/siyuan-share-api/models"
	"github.com/ZeroHawkeye/siyuan-share-api/routes"
	"github.com/gin-gonic/gin"
)

//go:embed dist/*
var staticFiles embed.FS

func main() {
	// 初始化数据库
	if err := models.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 如果没有用户则生成一次性引导令牌（写文件便于管理员查看）
	if bt, err := models.EnsureBootstrapToken(); err != nil {
		log.Printf("Failed to ensure bootstrap token: %v", err)
	} else if bt != nil {
		log.Printf("Bootstrap token available (expires %s)", bt.ExpiresAt.Format(time.RFC3339))
	}

	// 设置 Gin 模式
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建路由
	r := routes.SetupRouter(&staticFiles)

	// 启动服务器
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
