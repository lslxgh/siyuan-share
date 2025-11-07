package controllers

import (
	"net/http"

	"github.com/ZeroHawkeye/siyuan-share-api/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// GetShare 获取分享内容
func GetShare(c *gin.Context) {
	shareID := c.Param("id")

	var share models.Share
	if err := models.DB.Where("id = ?", shareID).First(&share).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 1,
			"msg":  "Share not found",
		})
		return
	}

	// 检查是否过期
	if share.IsExpired() {
		c.JSON(http.StatusGone, gin.H{
			"code": 1,
			"msg":  "Share has expired",
		})
		return
	}

	// 如果需要密码，验证密码
	if share.RequirePassword {
		password := c.Query("password")
		if password == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 1,
				"msg":  "Password required",
			})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 1,
				"msg":  "Invalid password",
			})
			return
		}
	}

	// 增加浏览次数
	models.DB.Model(&share).UpdateColumn("view_count", share.ViewCount+1)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": gin.H{
			"id":              share.ID,
			"docTitle":        share.DocTitle,
			"content":         share.Content,
			"requirePassword": share.RequirePassword,
			"expireAt":        share.ExpireAt,
			"viewCount":       share.ViewCount + 1,
			"createdAt":       share.CreatedAt,
		},
	})
}
