package models

import (
	"log"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB() error {
	// 确保数据目录存在
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	dbPath := filepath.Join(dataDir, "siyuan-share.db")
	log.Printf("Database path: %s", dbPath)

	// 配置 GORM
	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	// 使用 glebarez/sqlite 驱动连接数据库
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), config)
	if err != nil {
		return err
	}

	// 自动迁移数据库表结构
	if err := autoMigrate(); err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

// autoMigrate 自动迁移所有模型
func autoMigrate() error {
	return DB.AutoMigrate(
		&Share{},
		&User{},
		&BootstrapToken{},
	)
}
