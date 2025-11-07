package middleware

import (
	"net/http"
	"strings"

	"github.com/ZeroHawkeye/siyuan-share-api/models"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware 认证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 Header 中获取 Token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 1,
				"msg":  "Authorization header required",
			})
			c.Abort()
			return
		}

		// 解析 Bearer Token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 1,
				"msg":  "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		token := parts[1]

		// 验证 Token
		var user models.User
		if err := models.DB.Where("api_token = ? AND is_active = ?", token, true).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 1,
				"msg":  "Invalid or inactive token",
			})
			c.Abort()
			return
		}

		// 将用户 ID 存入上下文
		c.Set("userID", user.ID)
		c.Set("username", user.Username)

		c.Next()
	}
}
