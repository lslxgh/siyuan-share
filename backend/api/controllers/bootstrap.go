package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/ZeroHawkeye/siyuan-share-api/models"
	"github.com/gin-gonic/gin"
)

// BootstrapRequest 引导创建首用户请求
type BootstrapRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required"`
}

// BootstrapResponse 引导响应
type BootstrapResponse struct {
	UserID   string `json:"userId"`
	APIToken string `json:"apiToken"`
}

// Bootstrap 初始化首用户（仅当尚无用户 & 提供有效一次性令牌）
func Bootstrap(c *gin.Context) {
	// 若已有用户则拒绝
	var count int64
	if err := models.DB.Model(&models.User{}).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "DB error: " + err.Error()})
		return
	}
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "msg": "Bootstrap not allowed: users already exist"})
		return
	}

	// 读取令牌
	token := c.GetHeader("X-Bootstrap-Token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 1, "msg": "X-Bootstrap-Token header required"})
		return
	}

	var bt models.BootstrapToken
	if err := models.DB.Where("token = ? AND used = ?", token, false).First(&bt).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 1, "msg": "Invalid bootstrap token"})
		return
	}
	if time.Now().After(bt.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 1, "msg": "Bootstrap token expired"})
		return
	}

	var req BootstrapRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "msg": "Invalid request: " + err.Error()})
		return
	}

	// 创建用户
	apiToken := modelsRandomHex(32)
	user := &models.User{
		ID:       "user_" + modelsRandomHex(16),
		Username: req.Username,
		Email:    req.Email,
		APIToken: apiToken,
		IsActive: true,
	}
	if err := models.DB.Create(user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "Failed to create user: " + err.Error()})
		return
	}

	// 标记令牌已使用
	models.DB.Model(&bt).Update("used", true)

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": BootstrapResponse{UserID: user.ID, APIToken: apiToken}})
}

// Me 返回当前认证用户信息
func Me(c *gin.Context) {
	userID, _ := c.Get("userID")
	var user models.User
	if err := models.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "Failed to load user: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": gin.H{"id": user.ID, "username": user.Username, "email": user.Email, "isActive": user.IsActive, "createdAt": user.CreatedAt}})
}

// modelsRandomHex 重用随机 hex 生成（避免重复导入）
func modelsRandomHex(n int) string {
	return modelsRandomHexImpl(n)
}

func modelsRandomHexImpl(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
