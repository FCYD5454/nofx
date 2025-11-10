import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from './lib/api';
import { EquityChart } from './components/EquityChart';
import { AITradersPage } from './components/AITradersPage';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { CompetitionPage } from './components/CompetitionPage';
import { LandingPage } from './pages/LandingPage';
import AILearning from './components/AILearning';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { t, type Language } from './i18n/translations';
import { useSystemConfig } from './hooks/useSystemConfig';
import { Zap } from 'lucide-react';
import type {
  SystemStatus,
  AccountInfo,
  Position,
  DecisionRecord,
  Statistics,
  TraderInfo,
} from './types';

type Page = 'competition' | 'traders' | 'trader';

// 获取友好的AI模型名称
function getModelDisplayName(modelId: string): string {
  switch (modelId.toLowerCase()) {
    case 'deepseek':
      return 'DeepSeek';
    case 'qwen':
      return 'Qwen';
    case 'claude':
      return 'Claude';
    default:
      return modelId.toUpperCase();
  }
}

function App() {
  const { language, setLanguage } = useLanguage();
  const { user, token, logout, isLoading } = useAuth();
  const { config: systemConfig, loading: configLoading } = useSystemConfig();
  const [route, setRoute] = useState(window.location.pathname);

  // 从URL hash读取初始页面状态（支持刷新保持页面）
  const getInitialPage = (): Page => {
    const hash = window.location.hash.slice(1); // 去掉 #
    return hash === 'trader' || hash === 'details' ? 'trader' : 'competition';
  };

  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage());
  const [selectedTraderId, setSelectedTraderId] = useState<string | undefined>();
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--');

  // 监听URL hash变化，同步页面状态
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'trader' || hash === 'details') {
        setCurrentPage('trader');
      } else if (hash === 'competition' || hash === '') {
        setCurrentPage('competition');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 切换页面时更新URL hash (当前通过按钮直接调用setCurrentPage，这个函数暂时保留用于未来扩展)
  // const navigateToPage = (page: Page) => {
  //   setCurrentPage(page);
  //   window.location.hash = page === 'competition' ? '' : 'trader';
  // };

  // 获取trader列表
  const { data: traders } = useSWR<TraderInfo[]>('traders', api.getTraders, {
    refreshInterval: 10000,
  });

  // 当获取到traders后，设置默认选中第一个
  useEffect(() => {
    if (traders && traders.length > 0 && !selectedTraderId) {
      setSelectedTraderId(traders[0].trader_id);
    }
  }, [traders, selectedTraderId]);

  // 如果在trader页面，获取该trader的数据
  const { data: status } = useSWR<SystemStatus>(
    currentPage === 'trader' && selectedTraderId
      ? `status-${selectedTraderId}`
      : null,
    () => api.getStatus(selectedTraderId),
    {
      refreshInterval: 15000, // 15秒刷新（配合后端15秒缓存）
      revalidateOnFocus: false, // 禁用聚焦时重新验证，减少请求
      dedupingInterval: 10000, // 10秒去重，防止短时间内重复请求
    }
  );

  const { data: account } = useSWR<AccountInfo>(
    currentPage === 'trader' && selectedTraderId
      ? `account-${selectedTraderId}`
      : null,
    () => api.getAccount(selectedTraderId),
    {
      refreshInterval: 15000, // 15秒刷新（配合后端15秒缓存）
      revalidateOnFocus: false, // 禁用聚焦时重新验证，减少请求
      dedupingInterval: 10000, // 10秒去重，防止短时间内重复请求
    }
  );

  const { data: positions } = useSWR<Position[]>(
    currentPage === 'trader' && selectedTraderId
      ? `positions-${selectedTraderId}`
      : null,
    () => api.getPositions(selectedTraderId),
    {
      refreshInterval: 15000, // 15秒刷新（配合后端15秒缓存）
      revalidateOnFocus: false, // 禁用聚焦时重新验证，减少请求
      dedupingInterval: 10000, // 10秒去重，防止短时间内重复请求
    }
  );

  const { data: decisions } = useSWR<DecisionRecord[]>(
    currentPage === 'trader' && selectedTraderId
      ? `decisions/latest-${selectedTraderId}`
      : null,
    () => api.getLatestDecisions(selectedTraderId),
    {
      refreshInterval: 30000, // 30秒刷新（决策更新频率较低）
      revalidateOnFocus: false,
      dedupingInterval: 20000,
    }
  );

  const { data: stats } = useSWR<Statistics>(
    currentPage === 'trader' && selectedTraderId
      ? `statistics-${selectedTraderId}`
      : null,
    () => api.getStatistics(selectedTraderId),
    {
      refreshInterval: 30000, // 30秒刷新（统计数据更新频率较低）
      revalidateOnFocus: false,
      dedupingInterval: 20000,
    }
  );

  useEffect(() => {
    if (account) {
      const now = new Date().toLocaleTimeString();
      setLastUpdate(now);
    }
  }, [account]);

  const selectedTrader = traders?.find((t) => t.trader_id === selectedTraderId);

  // Handle routing
  useEffect(() => {
    const handlePopState = () => {
      setRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Show loading spinner while checking auth or config
  if (isLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B0E11' }}>
        <div className="text-center">
          <img src="/images/logo.png" alt="NoFx Logo" className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p style={{ color: '#EAECEF' }}>{t('loading', language)}</p>
        </div>
      </div>
    );
  }

  // Show landing page for root route when not authenticated
  if (!systemConfig?.admin_mode && (!user || !token)) {
    if (route === '/login') {
      return <LoginPage />;
    }
    if (route === '/register') {
      return <RegisterPage />;
    }
    // Default to landing page when not authenticated
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen" style={{ background: '#0B0E11', color: '#EAECEF' }}>
      {/* Header - Binance Style */}
      <header className="glass sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="relative flex items-center">
            {/* Left - Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="/icons/nofx.svg?v=2" alt="NOFX" className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: '#EAECEF' }}>
                  {t('appTitle', language)}
                </h1>
                <p className="text-xs mono" style={{ color: '#848E9C' }}>
                  {t('subtitle', language)}
                </p>
              </div>
            </div>
            
            {/* Center - Page Toggle (absolutely positioned) */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-1 rounded p-1" style={{ background: '#1E2329' }}>
              <button
                onClick={() => setCurrentPage('competition')}
                className={`px-3 py-2 rounded text-sm font-semibold transition-all`}
                style={currentPage === 'competition'
                  ? { background: '#F0B90B', color: '#000' }
                  : { background: 'transparent', color: '#848E9C' }
                }
              >
                {t('aiCompetition', language)}
              </button>
              <button
                onClick={() => setCurrentPage('traders')}
                className={`px-3 py-2 rounded text-sm font-semibold transition-all`}
                style={currentPage === 'traders'
                  ? { background: '#F0B90B', color: '#000' }
                  : { background: 'transparent', color: '#848E9C' }
                }
              >
                {t('aiTraders', language)}
              </button>
              <button
                onClick={() => setCurrentPage('trader')}
                className={`px-3 py-2 rounded text-sm font-semibold transition-all`}
                style={currentPage === 'trader'
                  ? { background: '#F0B90B', color: '#000' }
                  : { background: 'transparent', color: '#848E9C' }
                }
              >
                {t('tradingPanel', language)}
              </button>
            </div>
            
            {/* Right - Actions */}
            <div className="ml-auto flex items-center gap-3">

              {/* User Info - Only show if not in admin mode */}
              {!systemConfig?.admin_mode && user && (
                <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: '#1E2329', border: '1px solid #2B3139' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#F0B90B', color: '#000' }}>
                    {user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm" style={{ color: '#EAECEF' }}>{user.email}</span>
                </div>
              )}
              
              {/* Admin Mode Indicator */}
              {systemConfig?.admin_mode && (
                <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: '#1E2329', border: '1px solid #2B3139' }}>
                  <Zap className="w-4 h-4" style={{ color: '#F0B90B' }} />
                  <span className="text-sm font-semibold" style={{ color: '#F0B90B' }}>{t('adminMode', language)}</span>
                </div>
              )}

              {/* Language Toggle */}
              <div className="flex gap-1 rounded p-1" style={{ background: '#1E2329' }}>
                <button
                  onClick={() => setLanguage('zh')}
                  className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style={language === 'zh'
                    ? { background: '#F0B90B', color: '#000' }
                    : { background: 'transparent', color: '#848E9C' }
                  }
                >
                  中文
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style={language === 'en'
                    ? { background: '#F0B90B', color: '#000' }
                    : { background: 'transparent', color: '#848E9C' }
                  }
                >
                  EN
                </button>
              </div>

              {/* Logout Button - Only show if not in admin mode */}
              {!systemConfig?.admin_mode && (
                <button
                  onClick={logout}
                  className="px-3 py-2 rounded text-sm font-semibold transition-all hover:scale-105"
                  style={{ background: 'rgba(246, 70, 93, 0.1)', color: '#F6465D', border: '1px solid rgba(246, 70, 93, 0.2)' }}
                >
                  {t('logout', language)}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto px-6 py-6">
        {currentPage === 'competition' ? (
          <CompetitionPage />
        ) : currentPage === 'traders' ? (
          <AITradersPage 
            onTraderSelect={(traderId) => {
              setSelectedTraderId(traderId);
              setCurrentPage('trader');
            }}
          />
        ) : (
          <TraderDetailsPage
            selectedTrader={selectedTrader}
            status={status}
            account={account}
            positions={positions}
            decisions={decisions}
            stats={stats}
            lastUpdate={lastUpdate}
            language={language}
            traders={traders}
            selectedTraderId={selectedTraderId}
            onTraderSelect={setSelectedTraderId}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16" style={{ borderTop: '1px solid #2B3139', background: '#181A20' }}>
        <div className="max-w-[1920px] mx-auto px-6 py-6 text-center text-sm" style={{ color: '#5E6673' }}>
          <p>{t('footerTitle', language)}</p>
          <p className="mt-1">{t('footerWarning', language)}</p>
          <div className="mt-4">
            <a
              href="https://github.com/tinkle-community/nofx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded text-sm font-semibold transition-all hover:scale-105"
              style={{ background: '#1E2329', color: '#848E9C', border: '1px solid #2B3139' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2B3139';
                e.currentTarget.style.color = '#EAECEF';
                e.currentTarget.style.borderColor = '#F0B90B';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1E2329';
                e.currentTarget.style.color = '#848E9C';
                e.currentTarget.style.borderColor = '#2B3139';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Trader Details Page Component
function TraderDetailsPage({
  selectedTrader,
  status,
  account,
  positions,
  decisions,
  lastUpdate,
  language,
  traders,
  selectedTraderId,
  onTraderSelect,
}: {
  selectedTrader?: TraderInfo;
  traders?: TraderInfo[];
  selectedTraderId?: string;
  onTraderSelect: (traderId: string) => void;
  status?: SystemStatus;
  account?: AccountInfo;
  positions?: Position[];
  decisions?: DecisionRecord[];
  stats?: Statistics;
  lastUpdate: string;
  language: Language;
}) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handleManualDecision = async (traderId: string) => {
    if (isTriggering || cooldownSeconds > 0) {
      if (cooldownSeconds > 0) {
        setTriggerMessage(`⏰ 冷卻中，請等待 ${cooldownSeconds} 秒`);
        setTimeout(() => setTriggerMessage(null), 2000);
      }
      return;
    }
    
    setIsTriggering(true);
    setTriggerMessage(null);
    
    try {
      await api.triggerManualDecision(traderId);
      setTriggerMessage('✓ AI決策已觸發並執行！');
      setTimeout(() => setTriggerMessage(null), 3000);
      
      // 開始30秒冷卻倒數
      setCooldownSeconds(30);
      const timer = setInterval(() => {
        setCooldownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      console.error('觸發決策失敗:', error);
      
      // 處理429錯誤（冷卻時間）
      if (error.response?.status === 429) {
        const errorData = error.response.data;
        const retryAfter = errorData.retry_after || 30;
        setTriggerMessage(`⏰ ${errorData.error || '請稍後再試'}`);
        
        // 同步冷卻計時器
        setCooldownSeconds(retryAfter);
        const timer = setInterval(() => {
          setCooldownSeconds(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setTriggerMessage('✗ 觸發失敗，請稍後再試');
      }
      
      setTimeout(() => setTriggerMessage(null), 3000);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleBatchDecision = async (traderId: string) => {
    if (isTriggering || cooldownSeconds > 0) {
      if (cooldownSeconds > 0) {
        setTriggerMessage(`⏰ 冷卻中，請等待 ${cooldownSeconds} 秒`);
        setTimeout(() => setTriggerMessage(null), 2000);
      }
      return;
    }
    
    setIsTriggering(true);
    setTriggerMessage(null);
    
    try {
      const result = await api.triggerBatchDecision(traderId);
      setTriggerMessage(`✓ 批量AI決策已觸發！正在重新評估 ${result.position_count} 個持倉`);
      setTimeout(() => setTriggerMessage(null), 4000);
      
      // 開始30秒冷卻倒數
      setCooldownSeconds(30);
      const timer = setInterval(() => {
        setCooldownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      console.error('批量觸發失敗:', error);
      
      // 處理429錯誤（冷卻時間）
      if (error.response?.status === 429) {
        const errorData = error.response.data;
        const retryAfter = errorData.retry_after || 30;
        setTriggerMessage(`⏰ ${errorData.error || '請稍後再試'}`);
        
        // 同步冷卻計時器
        setCooldownSeconds(retryAfter);
        const timer = setInterval(() => {
          setCooldownSeconds(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (error.response?.status === 400) {
        setTriggerMessage('✗ 當前沒有持倉');
      } else {
        setTriggerMessage('✗ 批量觸發失敗，請稍後再試');
      }
      
      setTimeout(() => setTriggerMessage(null), 3000);
    } finally {
      setIsTriggering(false);
    }
  };

  const handlePreviewDecision = async (traderId: string) => {
    setIsLoadingPreview(true);
    try {
      const preview = await api.previewDecision(traderId);
      setPreviewData(preview);
      setShowPreviewModal(true);
    } catch (error) {
      console.error('預覽失敗:', error);
      setTriggerMessage('✗ 預覽失敗，請稍後再試');
      setTimeout(() => setTriggerMessage(null), 3000);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExecutePreviewedDecision = async (traderId: string) => {
    setShowPreviewModal(false);
    setPreviewData(null);
    // 執行實際決策
    await handleManualDecision(traderId);
  };

  if (!selectedTrader) {
    return (
      <div className="space-y-6">
        {/* Loading Skeleton - Binance Style */}
        <div className="binance-card p-6 animate-pulse">
          <div className="skeleton h-8 w-48 mb-3"></div>
          <div className="flex gap-4">
            <div className="skeleton h-4 w-32"></div>
            <div className="skeleton h-4 w-24"></div>
            <div className="skeleton h-4 w-28"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="binance-card p-5 animate-pulse">
              <div className="skeleton h-4 w-24 mb-3"></div>
              <div className="skeleton h-8 w-32"></div>
            </div>
          ))}
        </div>
        <div className="binance-card p-6 animate-pulse">
          <div className="skeleton h-6 w-40 mb-4"></div>
          <div className="skeleton h-64 w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Trader Header */}
      <div className="mb-6 rounded p-6 animate-scale-in" style={{ background: 'linear-gradient(135deg, rgba(240, 185, 11, 0.15) 0%, rgba(252, 213, 53, 0.05) 100%)', border: '1px solid rgba(240, 185, 11, 0.2)', boxShadow: '0 0 30px rgba(240, 185, 11, 0.15)' }}>
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#EAECEF' }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #F0B90B 0%, #FCD535 100%)' }}>
              🤖
            </span>
            {selectedTrader.trader_name}
          </h2>
          
          {/* Trader Selector */}
          {traders && traders.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: '#848E9C' }}>{t('switchTrader', language)}:</span>
              <select
                value={selectedTraderId}
                onChange={(e) => onTraderSelect(e.target.value)}
                className="rounded px-3 py-2 text-sm font-medium cursor-pointer transition-colors"
                style={{ background: '#1E2329', border: '1px solid #2B3139', color: '#EAECEF' }}
              >
                {traders.map((trader) => (
                  <option key={trader.trader_id} value={trader.trader_id}>
                    {trader.trader_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm" style={{ color: '#848E9C' }}>
          <span>AI Model: <span className="font-semibold" style={{ color: selectedTrader.ai_model.includes('qwen') ? '#c084fc' : '#60a5fa' }}>{getModelDisplayName(selectedTrader.ai_model.split('_').pop() || selectedTrader.ai_model)}</span></span>
          {status && (
            <>
              <span>•</span>
              <span>Cycles: {status.call_count}</span>
              <span>•</span>
              <span>Runtime: {status.runtime_minutes} min</span>
            </>
          )}
        </div>
      </div>

      {/* Debug Info */}
      {account && (
        <div className="mb-4 p-3 rounded text-xs font-mono" style={{ background: '#1E2329', border: '1px solid #2B3139' }}>
          <div style={{ color: '#848E9C' }}>
            🔄 Last Update: {lastUpdate} | Total Equity: {account?.total_equity?.toFixed(2) || '0.00'} |
            Available: {account?.available_balance?.toFixed(2) || '0.00'} | P&L: {account?.total_pnl?.toFixed(2) || '0.00'}{' '}
            ({account?.total_pnl_pct?.toFixed(2) || '0.00'}%)
          </div>
        </div>
      )}

      {/* Account Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title={t('totalEquity', language)}
          value={`${account?.total_equity?.toFixed(2) || '0.00'} USDT`}
          change={account?.total_pnl_pct || 0}
          positive={(account?.total_pnl ?? 0) > 0}
        />
        <StatCard
          title={t('availableBalance', language)}
          value={`${account?.available_balance?.toFixed(2) || '0.00'} USDT`}
          subtitle={`${(account?.available_balance && account?.total_equity ? ((account.available_balance / account.total_equity) * 100).toFixed(1) : '0.0')}% ${t('free', language)}`}
        />
        <StatCard
          title={t('totalPnL', language)}
          value={`${account?.total_pnl !== undefined && account.total_pnl >= 0 ? '+' : ''}${account?.total_pnl?.toFixed(2) || '0.00'} USDT`}
          change={account?.total_pnl_pct || 0}
          positive={(account?.total_pnl ?? 0) >= 0}
        />
        <StatCard
          title={t('positions', language)}
          value={`${account?.position_count || 0}`}
          subtitle={`${t('margin', language)}: ${account?.margin_used_pct?.toFixed(1) || '0.0'}%`}
        />
      </div>

      {/* 主要内容区：左右分屏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 左侧：图表 + 持仓 */}
        <div className="space-y-6">
          {/* Equity Chart */}
          <div className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
            <EquityChart traderId={selectedTrader.trader_id} />
          </div>

          {/* Current Positions */}
          <div className="binance-card p-6 animate-slide-in" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#EAECEF' }}>
            📈 {t('currentPositions', language)}
          </h2>
          <div className="flex items-center gap-3">
            {triggerMessage && (
              <div 
                className="text-xs px-3 py-1 rounded animate-slide-in"
                style={{ 
                  background: triggerMessage.startsWith('✓') ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)', 
                  color: triggerMessage.startsWith('✓') ? '#0ECB81' : '#F6465D',
                  border: `1px solid ${triggerMessage.startsWith('✓') ? 'rgba(14, 203, 129, 0.2)' : 'rgba(246, 70, 93, 0.2)'}`
                }}
              >
                {triggerMessage}
              </div>
            )}
            {positions && positions.length > 0 && (
              <>
                <button
                  onClick={() => handlePreviewDecision(selectedTrader.trader_id)}
                  disabled={isLoadingPreview}
                  className="px-3 py-1.5 rounded text-xs font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isLoadingPreview
                      ? 'linear-gradient(135deg, #848E9C 0%, #6B7280 100%)'
                      : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    cursor: isLoadingPreview ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                  }}
                  title={isLoadingPreview ? '正在載入預覽...' : 'AI決策預覽（不執行）'}
                >
                  {isLoadingPreview ? '⏳ 載入中...' : '👁️ 預覽'}
                </button>
                <button
                  onClick={() => handleBatchDecision(selectedTrader.trader_id)}
                  disabled={isTriggering || cooldownSeconds > 0}
                  className="px-3 py-1.5 rounded text-xs font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isTriggering || cooldownSeconds > 0
                      ? 'linear-gradient(135deg, #848E9C 0%, #6B7280 100%)'
                      : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                    color: '#fff',
                    border: 'none',
                    cursor: isTriggering || cooldownSeconds > 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                  }}
                  title={
                    cooldownSeconds > 0 
                      ? `冷卻中，還需 ${cooldownSeconds} 秒` 
                      : isTriggering 
                        ? '批量決策執行中...' 
                        : `批量觸發所有 ${positions.length} 個持倉的AI決策`
                  }
                >
                  {cooldownSeconds > 0 
                    ? `⏰ ${cooldownSeconds}s` 
                    : isTriggering 
                      ? '⏳ 執行中...' 
                      : `🚀 批量AI決策 (${positions.length})`}
                </button>
                <div className="text-xs px-3 py-1 rounded" style={{ background: 'rgba(240, 185, 11, 0.1)', color: '#F0B90B', border: '1px solid rgba(240, 185, 11, 0.2)' }}>
                  {positions.length} {t('active', language)}
                </div>
              </>
            )}
          </div>
        </div>
        {positions && positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left border-b border-gray-800">
                <tr>
                  <th className="pb-3 font-semibold text-gray-400">{t('symbol', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">{t('side', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">{t('entryPrice', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">{t('markPrice', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">{t('quantity', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">{t('positionValue', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">{t('leverage', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">{t('unrealizedPnL', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">{t('liqPrice', language)}</th>
                  <th className="pb-3 font-semibold text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, i) => (
                  <tr key={i} className="border-b border-gray-800 last:border-0">
                    <td className="py-3">
                      <div className="font-mono font-semibold">{pos.symbol}</div>
                      {pos.last_decision_time && (
                        <div className="text-xs mt-1" style={{ color: '#848E9C' }}>
                          <div>
                            最後決策: {new Date(pos.last_decision_time).toLocaleString('zh-TW', { 
                              month: '2-digit', 
                              day: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                          <div className="font-semibold" style={{ 
                            color: pos.last_decision_action?.includes('open') ? '#0ECB81' : 
                                   pos.last_decision_action?.includes('close') ? '#F6465D' : '#F0B90B' 
                          }}>
                            {pos.last_decision_action}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-bold"
                        style={pos.side === 'long'
                          ? { background: 'rgba(14, 203, 129, 0.1)', color: '#0ECB81' }
                          : { background: 'rgba(246, 70, 93, 0.1)', color: '#F6465D' }
                        }
                      >
                        {t(pos.side === 'long' ? 'long' : 'short', language)}
                      </span>
                    </td>
                    <td className="py-3 font-mono" style={{ color: '#EAECEF' }}>{pos.entry_price.toFixed(4)}</td>
                    <td className="py-3 font-mono" style={{ color: '#EAECEF' }}>{pos.mark_price.toFixed(4)}</td>
                    <td className="py-3 font-mono" style={{ color: '#EAECEF' }}>{pos.quantity.toFixed(4)}</td>
                    <td className="py-3 font-mono font-bold" style={{ color: '#EAECEF' }}>
                      {(pos.quantity * pos.mark_price).toFixed(2)} USDT
                    </td>
                    <td className="py-3 font-mono" style={{ color: '#F0B90B' }}>{pos.leverage}x</td>
                    <td className="py-3 font-mono">
                      <span
                        style={{ color: pos.unrealized_pnl >= 0 ? '#0ECB81' : '#F6465D', fontWeight: 'bold' }}
                      >
                        {pos.unrealized_pnl >= 0 ? '+' : ''}
                        {pos.unrealized_pnl.toFixed(2)} ({pos.unrealized_pnl_pct.toFixed(2)}%)
                      </span>
                    </td>
                    <td className="py-3 font-mono" style={{ color: '#848E9C' }}>
                      {pos.liquidation_price.toFixed(4)}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleManualDecision(selectedTrader.trader_id)}
                        disabled={isTriggering || cooldownSeconds > 0}
                        className="px-3 py-1.5 rounded text-xs font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: isTriggering || cooldownSeconds > 0
                            ? 'linear-gradient(135deg, #848E9C 0%, #6B7280 100%)'
                            : 'linear-gradient(135deg, #F0B90B 0%, #E1A706 100%)',
                          color: '#000',
                          border: 'none',
                          cursor: isTriggering || cooldownSeconds > 0 ? 'not-allowed' : 'pointer',
                          boxShadow: '0 2px 8px rgba(240, 185, 11, 0.3)'
                        }}
                        title={
                          cooldownSeconds > 0 
                            ? `冷卻中，還需 ${cooldownSeconds} 秒` 
                            : isTriggering 
                              ? '決策執行中...' 
                              : '立即觸發AI決策（30秒冷卻）'
                        }
                      >
                        {cooldownSeconds > 0 
                          ? `⏰ ${cooldownSeconds}s` 
                          : isTriggering 
                            ? '⏳ 執行中...' 
                            : '🤖 AI決策'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16" style={{ color: '#848E9C' }}>
            <div className="text-6xl mb-4 opacity-50">📊</div>
            <div className="text-lg font-semibold mb-2">{t('noPositions', language)}</div>
            <div className="text-sm">{t('noActivePositions', language)}</div>
          </div>
        )}

        {/* Preview Decision Modal */}
        {showPreviewModal && previewData && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.7)' }}
            onClick={() => setShowPreviewModal(false)}
          >
            <div 
              className="binance-card p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#EAECEF' }}>
                  👁️ AI 決策預覽
                </h2>
                <button 
                  onClick={() => setShowPreviewModal(false)}
                  className="text-2xl hover:scale-110 transition-transform"
                  style={{ color: '#848E9C' }}
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 p-3 rounded" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <p className="text-sm" style={{ color: '#10B981' }}>
                  ℹ️ 這是 AI 基於當前市場條件的建議決策。點擊「執行決策」將實際執行這些操作。
                </p>
              </div>

              {/* AI 思維鏈 */}
              {previewData.cot_trace && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#F0B90B' }}>
                    💭 AI 推理過程
                  </h3>
                  <div 
                    className="rounded p-4 text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto"
                    style={{ background: '#0B0E11', border: '1px solid #2B3139', color: '#EAECEF' }}
                  >
                    {previewData.cot_trace}
                  </div>
                </div>
              )}

              {/* 建議的決策 */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#EAECEF' }}>
                  📋 建議操作 ({previewData.decision_count} 個)
                </h3>
                {previewData.decisions && previewData.decisions.length > 0 ? (
                  <div className="space-y-2">
                    {previewData.decisions.map((action: any, idx: number) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 rounded"
                        style={{ background: '#0B0E11', border: '1px solid #2B3139' }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold" style={{ color: '#EAECEF' }}>
                            {action.symbol}
                          </span>
                          <span
                            className="px-2 py-1 rounded text-xs font-bold"
                            style={{
                              background: action.action.includes('open') 
                                ? 'rgba(14, 203, 129, 0.1)' 
                                : action.action.includes('close')
                                  ? 'rgba(246, 70, 93, 0.1)'
                                  : 'rgba(240, 185, 11, 0.1)',
                              color: action.action.includes('open')
                                ? '#0ECB81'
                                : action.action.includes('close')
                                  ? '#F6465D'
                                  : '#F0B90B'
                            }}
                          >
                            {action.action}
                          </span>
                          {action.leverage && (
                            <span className="text-xs" style={{ color: '#F0B90B' }}>
                              {action.leverage}x
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4" style={{ color: '#848E9C' }}>
                    AI 建議維持當前持倉，無需操作
                  </div>
                )}
              </div>

              {/* 操作按鈕 */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleExecutePreviewedDecision(selectedTrader.trader_id)}
                  disabled={isTriggering || cooldownSeconds > 0}
                  className="flex-1 py-3 rounded font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50"
                  style={{
                    background: isTriggering || cooldownSeconds > 0
                      ? 'linear-gradient(135deg, #848E9C 0%, #6B7280 100%)'
                      : 'linear-gradient(135deg, #0ECB81 0%, #0B9F6E 100%)',
                    color: '#000',
                    border: 'none'
                  }}
                >
                  {isTriggering ? '⏳ 執行中...' : cooldownSeconds > 0 ? `⏰ ${cooldownSeconds}s` : '✓ 執行決策'}
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 py-3 rounded font-semibold transition-all duration-200 hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #F6465D 0%, #D93E4F 100%)',
                    color: '#fff',
                    border: 'none'
                  }}
                >
                  ✗ 取消
                </button>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
        {/* 左侧结束 */}

        {/* 右侧：Recent Decisions - 卡片容器 */}
        <div className="binance-card p-6 animate-slide-in h-fit lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)]" style={{ animationDelay: '0.2s' }}>
          {/* 标题 */}
          <div className="flex items-center gap-3 mb-5 pb-4 border-b" style={{ borderColor: '#2B3139' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}>
              🧠
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#EAECEF' }}>{t('recentDecisions', language)}</h2>
              {decisions && decisions.length > 0 && (
                <div className="text-xs" style={{ color: '#848E9C' }}>
                  {t('lastCycles', language, { count: decisions.length })}
                </div>
              )}
            </div>
          </div>

          {/* 决策列表 - 可滚动 */}
          <div className="space-y-4 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {decisions && decisions.length > 0 ? (
              decisions.map((decision, i) => (
                <DecisionCard key={i} decision={decision} language={language} />
              ))
            ) : (
              <div className="py-16 text-center">
                <div className="text-6xl mb-4 opacity-30">🧠</div>
                <div className="text-lg font-semibold mb-2" style={{ color: '#EAECEF' }}>{t('noDecisionsYet', language)}</div>
                <div className="text-sm" style={{ color: '#848E9C' }}>{t('aiDecisionsWillAppear', language)}</div>
              </div>
            )}
          </div>
        </div>
        {/* 右侧结束 */}
      </div>

      {/* AI Learning & Performance Analysis */}
      <div className="mb-6 animate-slide-in" style={{ animationDelay: '0.3s' }}>
        <AILearning traderId={selectedTrader.trader_id} />
      </div>
    </div>
  );
}

// Stat Card Component - Binance Style Enhanced
function StatCard({
  title,
  value,
  change,
  positive,
  subtitle,
}: {
  title: string;
  value: string;
  change?: number;
  positive?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="text-xs mb-2 mono uppercase tracking-wider" style={{ color: '#848E9C' }}>{title}</div>
      <div className="text-2xl font-bold mb-1 mono" style={{ color: '#EAECEF' }}>{value}</div>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          <div
            className="text-sm mono font-bold"
            style={{ color: positive ? '#0ECB81' : '#F6465D' }}
          >
            {positive ? '▲' : '▼'} {positive ? '+' : ''}
            {change.toFixed(2)}%
          </div>
        </div>
      )}
      {subtitle && <div className="text-xs mt-2 mono" style={{ color: '#848E9C' }}>{subtitle}</div>}
    </div>
  );
}

// Decision Card Component with CoT Trace - Binance Style
function DecisionCard({ decision, language }: { decision: DecisionRecord; language: Language }) {
  const [showInputPrompt, setShowInputPrompt] = useState(false);
  const [showCoT, setShowCoT] = useState(false);

  return (
    <div className="rounded p-5 transition-all duration-300 hover:translate-y-[-2px]" style={{ border: '1px solid #2B3139', background: '#1E2329', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold" style={{ color: '#EAECEF' }}>{t('cycle', language)} #{decision.cycle_number}</div>
          <div className="text-xs" style={{ color: '#848E9C' }}>
            {new Date(decision.timestamp).toLocaleString()}
          </div>
        </div>
        <div
          className="px-3 py-1 rounded text-xs font-bold"
          style={decision.success
            ? { background: 'rgba(14, 203, 129, 0.1)', color: '#0ECB81' }
            : { background: 'rgba(246, 70, 93, 0.1)', color: '#F6465D' }
          }
        >
          {t(decision.success ? 'success' : 'failed', language)}
        </div>
      </div>

      {/* Input Prompt - Collapsible */}
      {decision.input_prompt && (
        <div className="mb-3">
          <button
            onClick={() => setShowInputPrompt(!showInputPrompt)}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: '#60a5fa' }}
          >
            <span className="font-semibold">📥 {t('inputPrompt', language)}</span>
            <span className="text-xs">{showInputPrompt ? t('collapse', language) : t('expand', language)}</span>
          </button>
          {showInputPrompt && (
            <div className="mt-2 rounded p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto" style={{ background: '#0B0E11', border: '1px solid #2B3139', color: '#EAECEF' }}>
              {decision.input_prompt}
            </div>
          )}
        </div>
      )}

      {/* AI Chain of Thought - Collapsible */}
      {decision.cot_trace && (
        <div className="mb-3">
          <button
            onClick={() => setShowCoT(!showCoT)}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: '#F0B90B' }}
          >
            <span className="font-semibold">📤 {t('aiThinking', language)}</span>
            <span className="text-xs">{showCoT ? t('collapse', language) : t('expand', language)}</span>
          </button>
          {showCoT && (
            <div className="mt-2 rounded p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto" style={{ background: '#0B0E11', border: '1px solid #2B3139', color: '#EAECEF' }}>
              {decision.cot_trace}
            </div>
          )}
        </div>
      )}

      {/* Decisions Actions */}
      {decision.decisions && decision.decisions.length > 0 && (
        <div className="space-y-2 mb-3">
          {decision.decisions.map((action, j) => (
            <div key={j} className="flex items-center gap-2 text-sm rounded px-3 py-2" style={{ background: '#0B0E11' }}>
              <span className="font-mono font-bold" style={{ color: '#EAECEF' }}>{action.symbol}</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={action.action.includes('open')
                  ? { background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa' }
                  : { background: 'rgba(240, 185, 11, 0.1)', color: '#F0B90B' }
                }
              >
                {action.action}
              </span>
              {action.leverage > 0 && <span style={{ color: '#F0B90B' }}>{action.leverage}x</span>}
              {action.price > 0 && (
                <span className="font-mono text-xs" style={{ color: '#848E9C' }}>@{action.price.toFixed(4)}</span>
              )}
              <span style={{ color: action.success ? '#0ECB81' : '#F6465D' }}>
                {action.success ? '✓' : '✗'}
              </span>
              {action.error && <span className="text-xs ml-2" style={{ color: '#F6465D' }}>{action.error}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Account State Summary */}
      {decision.account_state && (
        <div className="flex gap-4 text-xs mb-3 rounded px-3 py-2" style={{ background: '#0B0E11', color: '#848E9C' }}>
          <span>净值: {decision.account_state.total_balance.toFixed(2)} USDT</span>
          <span>可用: {decision.account_state.available_balance.toFixed(2)} USDT</span>
          <span>保证金率: {decision.account_state.margin_used_pct.toFixed(1)}%</span>
          <span>持仓: {decision.account_state.position_count}</span>
        </div>
      )}

      {/* Execution Logs */}
      {decision.execution_log && decision.execution_log.length > 0 && (
        <div className="space-y-1">
          {decision.execution_log.map((log, k) => (
            <div
              key={k}
              className="text-xs font-mono"
              style={{ color: log.includes('✓') || log.includes('成功') ? '#0ECB81' : '#F6465D' }}
            >
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {decision.error_message && (
        <div className="text-sm rounded px-3 py-2 mt-3" style={{ color: '#F6465D', background: 'rgba(246, 70, 93, 0.1)' }}>
          ❌ {decision.error_message}
        </div>
      )}
    </div>
  );
}

// Wrap App with providers
export default function AppWithProviders() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LanguageProvider>
  );
}
