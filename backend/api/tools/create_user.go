package main

import (
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"log"

	"github.com/ZeroHawkeye/siyuan-share-api/models"
)

func main() {
	username := flag.String("username", "", "用户名")
	email := flag.String("email", "", "邮箱")
	flag.Parse()

	if *username == "" || *email == "" {
		log.Fatal("请提供用户名和邮箱：-username <用户名> -email <邮箱>")
	}

	// 初始化数据库
	if err := models.InitDB(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	// 生成 API Token
	apiToken := generateAPIToken()

	// 生成用户 ID
	userID := generateUserID()

	// 创建用户
	user := &models.User{
		ID:       userID,
		Username: *username,
		Email:    *email,
		APIToken: apiToken,
		IsActive: true,
	}

	if err := models.DB.Create(user).Error; err != nil {
		log.Fatalf("创建用户失败: %v", err)
	}

	fmt.Println("✅ 用户创建成功！")
	fmt.Println("====================")
	fmt.Printf("用户 ID: %s\n", userID)
	fmt.Printf("用户名: %s\n", *username)
	fmt.Printf("邮箱: %s\n", *email)
	fmt.Printf("API Token: %s\n", apiToken)
	fmt.Println("====================")
	fmt.Println("请妥善保存 API Token，它将用于插件认证。")
}

func generateAPIToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateUserID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "user_" + hex.EncodeToString(b)
}
