package controllers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

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

	// 处理引用链接替换
	content := share.Content
	if share.References != "" {
		var refs []models.BlockReference
		if err := json.Unmarshal([]byte(share.References), &refs); err == nil {
			// 获取 baseURL 用于构建引用块分享链接
			baseURL := getBaseURL(c)
			content = replaceBlockReferences(content, refs, baseURL, share.UserID)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": gin.H{
			"id":              share.ID,
			"docTitle":        share.DocTitle,
			"content":         content,
			"requirePassword": share.RequirePassword,
			"expireAt":        share.ExpireAt,
			"viewCount":       share.ViewCount + 1,
			"createdAt":       share.CreatedAt,
		},
	})
}

// getBaseURL 获取基础 URL
func getBaseURL(c *gin.Context) string {
	baseURL := c.GetHeader("X-Base-URL")
	if baseURL == "" {
		proto := c.GetHeader("X-Forwarded-Proto")
		host := c.GetHeader("X-Forwarded-Host")
		if proto == "" {
			if c.Request.TLS != nil {
				proto = "https"
			} else {
				proto = "http"
			}
		}
		if host == "" {
			host = c.Request.Host
		}
		baseURL = proto + "://" + strings.TrimSuffix(host, "/")
	}
	return strings.TrimSuffix(baseURL, "/")
}

// replaceBlockReferences 替换内容中的块引用为指向引用块分享的 URL
func replaceBlockReferences(content string, refs []models.BlockReference, baseURL string, userID string) string {
	// 构建块ID到内容的映射
	blockMap := make(map[string]models.BlockReference)
	for _, ref := range refs {
		blockMap[ref.BlockID] = ref
	}

	// 匹配块引用: ((blockId)) 或 ((blockId "text")) 或 ((blockId 'text'))
	blockRefPattern := regexp.MustCompile(`\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)`)

	result := blockRefPattern.ReplaceAllStringFunc(content, func(match string) string {
		matches := blockRefPattern.FindStringSubmatch(match)
		if len(matches) < 2 {
			return match
		}

		blockID := matches[1]
		displayText := ""
		if len(matches) > 2 {
			displayText = matches[2]
		}

		// 查找引用块信息
		ref, exists := blockMap[blockID]
		if !exists {
			// 引用块不存在,保留显示文本或使用默认文本
			if displayText != "" {
				return displayText
			}
			return "[引用]"
		}

		// 查找该块的分享记录
		var blockShare models.Share
		err := models.DB.Where("user_id = ? AND doc_id = ?", userID, blockID).
			Order("created_at DESC").
			First(&blockShare).Error

		if err != nil {
			// 找不到块分享,降级显示为纯文本
			if displayText != "" {
				return displayText
			}
			if ref.Content != "" {
				if len(ref.Content) > 30 {
					return ref.Content[:30] + "..."
				}
				return ref.Content
			}
			return "[引用]"
		}

		// 生成指向块分享的 URL
		blockShareURL := baseURL + "/s/" + blockShare.ID

		// 确定显示文本
		linkText := displayText
		if linkText == "" {
			linkText = ref.DisplayText
		}
		if linkText == "" {
			// 使用引用块内容的前30个字符作为显示文本
			if len(ref.Content) > 30 {
				linkText = ref.Content[:30] + "..."
			} else if ref.Content != "" {
				linkText = ref.Content
			} else {
				linkText = "引用"
			}
		}

		return "[" + linkText + "](" + blockShareURL + ")"
	})

	return result
}
