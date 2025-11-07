package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID        string         `gorm:"primaryKey;size:64" json:"id"`
	Username  string         `gorm:"size:100;uniqueIndex" json:"username"`
	Email     string         `gorm:"size:255;uniqueIndex" json:"email"`
	APIToken  string         `gorm:"size:255;uniqueIndex" json:"-"` // 不在 JSON 中暴露
	IsActive  bool           `gorm:"default:true" json:"isActive"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}
