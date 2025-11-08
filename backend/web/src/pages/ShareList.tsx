import { ArrowLeftOutlined, CopyOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, message, Modal, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteShare, listShares, type ShareListItem } from '../api/share'

const { Title, Text } = Typography

function ShareList() {
  const navigate = useNavigate()
  const [shares, setShares] = useState<ShareListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const loadShares = async (currentPage = 1) => {
    setLoading(true)
    try {
      const res = await listShares(currentPage, pageSize)
      if (res.code === 0) {
        setShares(res.data.items || [])
        setTotal(res.data.total)
        setPage(currentPage)
      } else {
        message.error(res.msg || '加载失败')
      }
    } catch (e: any) {
      message.error(e.response?.data?.msg || e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadShares()
  }, [])

  const copyShareUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      message.success('链接已复制')
    }).catch(() => {
      message.error('复制失败')
    })
  }

  const handleDelete = async (id: string, docTitle: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分享"${docTitle}"吗？删除后无法恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteShare(id)
          if (res.code === 0) {
            message.success('删除成功')
            loadShares(page)
          } else {
            message.error(res.msg || '删除失败')
          }
        } catch (e: any) {
          message.error(e.response?.data?.msg || e.message || '删除失败')
        }
      }
    })
  }

  const isExpired = (expireAt: string) => {
    return new Date(expireAt) <= new Date()
  }

  const columns: ColumnsType<ShareListItem> = [
    {
      title: '文档标题',
      dataIndex: 'docTitle',
      key: 'docTitle',
      ellipsis: true,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '状态',
      dataIndex: 'expireAt',
      key: 'status',
      width: 100,
      render: (expireAt: string) => (
        <Tag color={isExpired(expireAt) ? 'default' : 'success'}>
          {isExpired(expireAt) ? '已过期' : '有效'}
        </Tag>
      )
    },
    {
      title: '访问控制',
      key: 'access',
      width: 120,
      render: (record: ShareListItem) => {
        if (record.requirePassword) {
          return <Tag color="orange">密码保护</Tag>
        }
        return record.isPublic ? <Tag color="blue">公开</Tag> : <Tag>仅链接</Tag>
      }
    },
    {
      title: '访问量',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.viewCount - b.viewCount,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString(),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: '到期时间',
      dataIndex: 'expireAt',
      key: 'expireAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString(),
      sorter: (a, b) => new Date(a.expireAt).getTime() - new Date(b.expireAt).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (record: ShareListItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyShareUrl(record.shareUrl)}
          >
            复制
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.docTitle)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div style={{ maxWidth: 1400, margin: '60px auto', padding: '0 24px' }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/dashboard')}
              >
                返回仪表盘
              </Button>
              <Title level={3} style={{ margin: 0 }}>
                分享管理
              </Title>
            </div>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => loadShares(page)}
              loading={loading}
            >
              刷新
            </Button>
          </div>
        </div>

        <Table
          dataSource={shares}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total: total,
            pageSize: pageSize,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: loadShares
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 0', color: 'rgba(0,0,0,0.25)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div>暂无分享记录</div>
              </div>
            )
          }}
        />
      </Card>
    </div>
  )
}

export default ShareList
