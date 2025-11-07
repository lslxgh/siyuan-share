import { useEffect, useState } from 'react'
import api from '../api'
import './Home.css'

interface HealthData {
  status: string
  ts: number
  userCount: number
  ginMode: string
  version: string
}

interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

interface BootstrapData {
  userId: string
  apiToken: string
}

function Home() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [bootstrapToken, setBootstrapToken] = useState('')
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null)
  const [bootstrapLoading, setBootstrapLoading] = useState(false)
  const [apiToken, setApiToken] = useState<string | null>(null)

  const loadHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/health') as HealthData
      setHealth(res)
    } catch (e: any) {
      setError(e.message || '无法连接后端')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
  }, [])

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !email.trim() || !bootstrapToken.trim()) {
      setBootstrapMsg('请填写所有字段')
      return
    }
    setBootstrapLoading(true)
    setBootstrapMsg(null)
    try {
      const res = await api.post('/api/bootstrap', { username, email }, { headers: { 'X-Bootstrap-Token': bootstrapToken } }) as ApiResponse<BootstrapData>
      console.log('Bootstrap 响应:', res)
      console.log('API Token:', res.data?.apiToken)
      if (res.code === 0) {
        setApiToken(res.data.apiToken)
        setBootstrapMsg('✅ 用户创建成功！请务必保存下方的 API Token')
        loadHealth()
      } else {
        setBootstrapMsg(res.msg || '创建失败')
      }
    } catch (e: any) {
      console.error('Bootstrap 错误:', e)
      setBootstrapMsg(e.response?.data?.msg || e.message || '创建失败')
    } finally {
      setBootstrapLoading(false)
    }
  }

  return (
    <div className="home">
      <h1>思源分享服务</h1>
      {loading && <p>加载健康状态...</p>}
      {error && <p className="error">{error}</p>}
      {health && (
        <div className="health-box">
          <p>状态: {health.status}</p>
          <p>用户数量: {health.userCount}</p>
          <p>版本: {health.version}</p>
          <p>模式: {health.ginMode || 'release'}</p>
        </div>
      )}
      {health && (health.userCount === 0 || apiToken) && (
        <div className="bootstrap-box">
          <h2>初始化首用户</h2>
          {health.userCount === 0 && (
            <>
              <p>请在服务器 data/bootstrap_token.txt 中获取一次性令牌，15 分钟内有效。</p>
              <form onSubmit={handleBootstrap}>
                <input
                  type="text"
                  placeholder="用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="一次性令牌"
                  value={bootstrapToken}
                  onChange={(e) => setBootstrapToken(e.target.value)}
                />
                <button type="submit" disabled={bootstrapLoading}>{bootstrapLoading ? '创建中...' : '创建用户'}</button>
              </form>
              {bootstrapMsg && <p className="msg">{bootstrapMsg}</p>}
            </>
          )}
          {apiToken && (
            <div className="token-result">
              <h3>🔑 API Token（请妥善保存）</h3>
              <div className="token-box">
                <code>{apiToken}</code>
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(apiToken)
                    alert('API Token 已复制到剪贴板')
                  }}
                >
                  复制
                </button>
              </div>
              <p className="token-tip">此 Token 将用于插件配置，请保存到安全的地方。</p>
              {health.userCount > 0 && (
                <button 
                  onClick={() => {
                    setApiToken(null)
                    setBootstrapMsg(null)
                    setUsername('')
                    setEmail('')
                    setBootstrapToken('')
                  }}
                  style={{ marginTop: '1rem' }}
                >
                  我已保存，关闭提示
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {health && health.userCount > 0 && (
        <div className="usage-box">
          <h2>使用说明</h2>
          <p>访问分享：/api/s/&lt;shareId&gt;，例如 <code>/api/s/xxxxxxxxxxxxxxxx</code></p>
          <p>在插件中配置服务地址与 API Token 后即可创建分享。</p>
        </div>
      )}
    </div>
  )
}

export default Home
