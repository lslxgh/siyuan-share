package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ZeroHawkeye/siyuan-share-api/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// CreateShareRequest 创建分享请求
type CreateShareRequest struct {
	DocID           string `json:"docId" binding:"required"`
	DocTitle        string `json:"docTitle" binding:"required"`
	Content         string `json:"content" binding:"required"`
	RequirePassword bool   `json:"requirePassword"`
	Password        string `json:"password"`
	ExpireDays      int    `json:"expireDays" binding:"required,min=1,max=365"`
	IsPublic        bool   `json:"isPublic"`
}

// CreateShareResponse 创建分享响应
type CreateShareResponse struct {
	ShareID         string    `json:"shareId"`
	ShareURL        string    `json:"shareUrl"`
	DocID           string    `json:"docId"`
	DocTitle        string    `json:"docTitle"`
	RequirePassword bool      `json:"requirePassword"`
	ExpireAt        time.Time `json:"expireAt"`
	IsPublic        bool      `json:"isPublic"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
	Reused          bool      `json:"reused"`
}

// BatchDeleteShareRequest 批量关闭分享请求
type BatchDeleteShareRequest struct {
	ShareIDs []string `json:"shareIds"`
}

// BatchDeleteShareResponse 批量关闭分享结果
type BatchDeleteShareResponse struct {
	Deleted         []string          `json:"deleted"`
	NotFound        []string          `json:"notFound"`
	Failed          map[string]string `json:"failed,omitempty"`
	DeletedAllCount int64             `json:"deletedAllCount,omitempty"`
}

// CreateShare 创建分享
func CreateShare(c *gin.Context) {
	var req CreateShareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 1,
			"msg":  "Invalid request: " + err.Error(),
		})
		return
	}

	// 获取用户 ID（从认证中间件）
	userID, _ := c.Get("userID")
	userIDStr := userID.(string)

	existingShare, err := models.FindActiveShareByDoc(userIDStr, req.DocID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 1,
			"msg":  "Failed to query share: " + err.Error(),
		})
		return
	}

	// 若已有分享但已过期，则视为无效
	if existingShare != nil && existingShare.IsExpired() {
		existingShare = nil
	}

	password := strings.TrimSpace(req.Password)

	if req.RequirePassword {
		if password != "" && len(password) < 4 {
			c.JSON(http.StatusBadRequest, gin.H{
				"code": 1,
				"msg":  "Password must be at least 4 characters",
			})
			return
		}
		if password == "" {
			if existingShare == nil || existingShare.PasswordHash == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"code": 1,
					"msg":  "Password must be provided for new share",
				})
				return
			}
		}
	}

	var share *models.Share
	reused := false
	if existingShare != nil {
		share = existingShare
		reused = true
	} else {
		share = &models.Share{
			ID:     generateShareID(),
			UserID: userIDStr,
			DocID:  req.DocID,
		}
	}

	share.DocTitle = req.DocTitle
	share.Content = req.Content
	share.RequirePassword = req.RequirePassword
	share.IsPublic = req.IsPublic
	share.ExpireAt = time.Now().AddDate(0, 0, req.ExpireDays)

	if req.RequirePassword {
		if password != "" {
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"code": 1,
					"msg":  "Failed to encrypt password",
				})
				return
			}
			share.PasswordHash = string(hashedPassword)
		}
		// 若为空，则复用旧密码（已有校验保证可复用）
	} else {
		share.PasswordHash = ""
	}

	if reused {
		if err := models.DB.Save(share).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code": 1,
				"msg":  "Failed to update share: " + err.Error(),
			})
			return
		}
	} else {
		if err := models.DB.Create(share).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code": 1,
				"msg":  "Failed to create share: " + err.Error(),
			})
			return
		}
	}

	// 构建分享 URL（双轨：自动推断 + 可被 X-Base-URL 覆盖）
	baseURL := c.GetHeader("X-Base-URL")
	if baseURL == "" {
		// 优先使用代理头
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
		// 移除可能存在的尾部斜杠
		baseURL = proto + "://" + strings.TrimSuffix(host, "/")
	}
	shareURL := strings.TrimSuffix(baseURL, "/") + "/s/" + share.ID

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": CreateShareResponse{
			ShareID:         share.ID,
			ShareURL:        shareURL,
			DocID:           share.DocID,
			DocTitle:        share.DocTitle,
			RequirePassword: share.RequirePassword,
			ExpireAt:        share.ExpireAt,
			IsPublic:        share.IsPublic,
			CreatedAt:       share.CreatedAt,
			UpdatedAt:       share.UpdatedAt,
			Reused:          reused,
		},
	})
}

// ListShares 获取用户的分享列表
func ListShares(c *gin.Context) {
	userID, _ := c.Get("userID")

	// 分页参数
	page := 1
	size := 10
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if s := c.Query("size"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			if v > 100 {
				v = 100
			}
			size = v
		}
	}
	offset := (page - 1) * size

	var total int64
	if err := models.DB.Model(&models.Share{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "msg": "Failed to count shares: " + err.Error()})
		return
	}

	var shares []models.Share
	if err := models.DB.Where("user_id = ?", userID).
		Order("created_at DESC").
		Offset(offset).Limit(size).
		Find(&shares).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 1,
			"msg":  "Failed to fetch shares: " + err.Error(),
		})
		return
	}

	// 返回轻量结构并附带 shareUrl
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
	baseURL = strings.TrimSuffix(baseURL, "/")

	type item struct {
		ID              string    `json:"id"`
		DocID           string    `json:"docId"`
		DocTitle        string    `json:"docTitle"`
		RequirePassword bool      `json:"requirePassword"`
		ExpireAt        time.Time `json:"expireAt"`
		IsPublic        bool      `json:"isPublic"`
		ViewCount       int       `json:"viewCount"`
		CreatedAt       time.Time `json:"createdAt"`
		ShareURL        string    `json:"shareUrl"`
	}
	items := make([]item, 0, len(shares))
	for _, s := range shares {
		items = append(items, item{
			ID:              s.ID,
			DocID:           s.DocID,
			DocTitle:        s.DocTitle,
			RequirePassword: s.RequirePassword,
			ExpireAt:        s.ExpireAt,
			IsPublic:        s.IsPublic,
			ViewCount:       s.ViewCount,
			CreatedAt:       s.CreatedAt,
			ShareURL:        baseURL + "/s/" + s.ID,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": gin.H{
			"items": items,
			"page":  page,
			"size":  size,
			"total": total,
		},
	})
}

// DeleteShare 删除分享
func DeleteShare(c *gin.Context) {
	shareID := c.Param("id")
	userID, _ := c.Get("userID")

	result := models.DB.Where("id = ? AND user_id = ?", shareID, userID).Delete(&models.Share{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 1,
			"msg":  "Failed to delete share: " + result.Error.Error(),
		})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 1,
			"msg":  "Share not found or unauthorized",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
	})
}

// DeleteSharesBatch 批量关闭分享
func DeleteSharesBatch(c *gin.Context) {
	var req BatchDeleteShareRequest
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 1,
			"msg":  "Invalid request: " + err.Error(),
		})
		return
	}

	userID := c.GetString("userID")

	// 如果没有指定分享 ID，则删除当前用户全部分享
	if len(req.ShareIDs) == 0 {
		count, err := models.DeleteSharesByUser(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code": 1,
				"msg":  "Failed to delete shares: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"code": 0,
			"msg":  "success",
			"data": BatchDeleteShareResponse{
				DeletedAllCount: count,
			},
		})
		return
	}

	response := BatchDeleteShareResponse{
		Deleted:  make([]string, 0, len(req.ShareIDs)),
		NotFound: []string{},
	}
	failed := map[string]string{}

	for _, shareID := range req.ShareIDs {
		shareID = strings.TrimSpace(shareID)
		if shareID == "" {
			continue
		}

		result := models.DB.Where("id = ? AND user_id = ?", shareID, userID).Delete(&models.Share{})
		if result.Error != nil {
			failed[shareID] = result.Error.Error()
			continue
		}
		if result.RowsAffected == 0 {
			response.NotFound = append(response.NotFound, shareID)
			continue
		}
		response.Deleted = append(response.Deleted, shareID)
	}

	if len(failed) > 0 {
		response.Failed = failed
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": response,
	})
}

// generateShareID 生成随机分享 ID
func generateShareID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
