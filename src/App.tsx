import React, { useState, useEffect, useMemo } from 'react';
import { Menu, X, Play, ListChecks, AlertTriangle, Clock, ChevronLeft, ChevronRight, Filter, Eye } from 'lucide-react';

interface InspectResult {
  id: string;
  sourceUrl: string;
  destinationUrl: string;
  target: string;
  detail: string;
  processStatus: string;
  isError: boolean;
  timestamp: string;
  diffStatus?: 'new' | 'removed' | 'unchanged';
}

const SUB_PAGES = [
  { id: 'home', name: '首頁', url: 'https://agrinetzero.moa.gov.tw/', subUrls: [] },
  {
    id: 'about', name: '認識農業淨零', url: 'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/Intro', subUrls: [
      'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/FourMain',
      'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/AgriGreenhouseGasInventory',
      'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/OperationFlagship',
      'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/NaturalCarbonSinkStrategy',
      'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/AgriCarbonReductionActions',
      'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/NetZeroRegulations'
    ]
  },
  {
    id: 'calc', name: '農業碳排計算', url: 'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonEmissionAndCalculate/Intro', subUrls: [
      'https://agrinetzero.moa.gov.tw/zh-TW/CarbonFactor/List',
      'https://agrinetzero.moa.gov.tw/zh-TW/PcrSearch/List',
      'https://agrinetzero.moa.gov.tw/zh-TW/CarbonFootprintSearch/List',
      'https://agrinetzero.moa.gov.tw/zh-TW/SimpleCalculator/List'
    ]
  },
  {
    id: 'credit', name: '農業碳權', url: 'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Intro?CurrentTab=Intro', subUrls: [
      'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Intro?CurrentTab=IncrementalGreenhouseGasOffset',
      'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Intro?CurrentTab=GreenHouseVoluntaryReductionProject',
      'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Regulations'
    ]
  },
  {
    id: 'energy', name: '農業綠能', url: 'https://agrinetzero.moa.gov.tw/zh-TW/Sge/About', subUrls: [
      'https://agrinetzero.moa.gov.tw/zh-TW/Sge/Regulations'
    ]
  },
  {
    id: 'circular', name: '循環農業', url: 'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/Intro', subUrls: [
      'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/About',
      'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/Info',
      'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/HowTo',
      'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/Regulations'
    ]
  },
  {
    id: 'esg', name: 'ESG STORE', url: 'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Intro', subUrls: [
      'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/About',
      'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Mission',
      'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Match',
      'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/CustomService',
      'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Cases',
      'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/FileDownload'
    ]
  },
  {
    id: 'info', name: '淨零資訊', url: 'https://agrinetzero.moa.gov.tw/zh-TW/News/List', subUrls: [
      'https://agrinetzero.moa.gov.tw/zh-TW/KnowledgeActivity/List'
    ]
  },
];

interface PageState {
  inspectionState: 'idle' | 'loading' | 'success' | 'error';
  results: InspectResult[];
  errorMessage: string;
  stats: { total: number; errors: number; timeElapsed: number };
  currentPage: number;
  filterStatus: 'all' | 'error' | 'success';
  filterProcessStatus: 'all' | '待處理' | '處理中' | '已解決';
  filterDiffStatus: 'all' | 'new' | 'removed' | 'unchanged';
  startTime: number | null;
  itemsPerPage: number;
  lastRunTime?: number;
  previousResults?: InspectResult[];
}

const defaultPageState: PageState = {
  inspectionState: 'idle',
  results: [],
  errorMessage: '',
  stats: { total: 0, errors: 0, timeElapsed: 0 },
  currentPage: 1,
  filterStatus: 'all',
  filterProcessStatus: 'all',
  filterDiffStatus: 'all',
  startTime: null,
  itemsPerPage: 20,
};

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedPage, setSelectedPage] = useState(SUB_PAGES[0]);

  const [pageStates, setPageStates] = useState<Record<string, PageState>>(() => {
    const saved = localStorage.getItem('agrinet-crawler-state-v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Map back to default structure in case of new fields
        const merged: Record<string, PageState> = {};
        SUB_PAGES.forEach(page => {
          merged[page.id] = parsed[page.id] ? { ...defaultPageState, ...parsed[page.id], inspectionState: parsed[page.id].inspectionState === 'loading' ? 'idle' : parsed[page.id].inspectionState } : { ...defaultPageState };
        });
        return merged;
      } catch (e) {
        console.error('Failed to parse cached states', e);
      }
    }
    return {};
  });

  const [selectedResult, setSelectedResult] = useState<InspectResult | null>(null);

  // Save to localStorage when pageStates changes
  useEffect(() => {
    localStorage.setItem('agrinet-crawler-state-v3', JSON.stringify(pageStates));
  }, [pageStates]);

  const getPageState = (pageId: string) => pageStates[pageId] || defaultPageState;
  const updatePageState = (pageId: string, updates: Partial<PageState> | ((prev: PageState) => Partial<PageState>)) => {
    setPageStates(prev => {
      const currentState = prev[pageId] || defaultPageState;
      const newUpdates = typeof updates === 'function' ? updates(currentState) : updates;
      return {
        ...prev,
        [pageId]: { ...currentState, ...newUpdates }
      };
    });
  };

  const currentState = getPageState(selectedPage.id);

  // Global timer for all loading pages
  useEffect(() => {
    const interval = setInterval(() => {
      setPageStates(prev => {
        let hasChanges = false;
        const next = { ...prev };
        for (const [pageId, stateValue] of Object.entries(next)) {
          const state = stateValue as PageState;
          if (state.inspectionState === 'loading' && state.startTime) {
            next[pageId] = {
              ...state,
              stats: {
                ...state.stats,
                timeElapsed: Math.floor((Date.now() - state.startTime) / 1000)
              }
            };
            hasChanges = true;
          }
        }
        return hasChanges ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const startInspection = async () => {
    const pageId = selectedPage.id;
    updatePageState(pageId, prev => ({
      inspectionState: 'loading',
      results: [],
      errorMessage: '',
      stats: { total: 0, errors: 0, timeElapsed: 0 },
      currentPage: 1,
      startTime: Date.now(),
      previousResults: prev.results.length > 0 ? prev.results : prev.previousResults
    }));
    setSelectedResult(null);

    try {
      const response = await fetch('/api/inspect-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: selectedPage.url, subUrls: selectedPage.subUrls || [] })
      });

      const data = await response.json();

      if (data.success) {
        updatePageState(pageId, prev => {
          const newResults: InspectResult[] = data.data;
          const oldResults = prev.previousResults || [];

          if (oldResults.length > 0) {
            const oldKeys = new Set(oldResults.map(r => `${r.sourceUrl}|${r.destinationUrl}|${r.target}`));
            const newKeys = new Set(newResults.map(r => `${r.sourceUrl}|${r.destinationUrl}|${r.target}`));

            newResults.forEach(r => {
              const key = `${r.sourceUrl}|${r.destinationUrl}|${r.target}`;
              if (!oldKeys.has(key)) r.diffStatus = 'new';
              else r.diffStatus = 'unchanged';
            });

            // Append removed items for full diff visualization
            oldResults.forEach(r => {
              const key = `${r.sourceUrl}|${r.destinationUrl}|${r.target}`;
              if (!newKeys.has(key)) {
                newResults.push({ ...r, diffStatus: 'removed', isError: true, detail: '此連結已從畫面上移除' });
              }
            });
          } else {
            newResults.forEach(r => r.diffStatus = 'unchanged');
          }

          // Sort so that new/removed items are at the top
          newResults.sort((a, b) => {
            if (a.diffStatus === 'removed' && b.diffStatus !== 'removed') return -1;
            if (b.diffStatus === 'removed' && a.diffStatus !== 'removed') return 1;
            if (a.diffStatus === 'new' && b.diffStatus !== 'new') return -1;
            if (b.diffStatus === 'new' && a.diffStatus !== 'new') return 1;
            if (a.isError !== b.isError) return a.isError ? -1 : 1;
            return 0;
          });

          return {
            results: newResults,
            stats: {
              total: newResults.length,
              errors: newResults.filter(r => r.isError && r.diffStatus !== 'removed').length,
              timeElapsed: prev.stats.timeElapsed
            },
            inspectionState: 'success',
            startTime: null,
            lastRunTime: Date.now()
          };
        });
      } else {
        updatePageState(pageId, prev => ({
          errorMessage: data.message || '檢測失敗',
          inspectionState: 'error',
          startTime: null,
          stats: { ...prev.stats, timeElapsed: prev.stats.timeElapsed }
        }));
      }
    } catch (error: any) {
      updatePageState(pageId, prev => ({
        errorMessage: error.message || '連線錯誤',
        inspectionState: 'error',
        startTime: null,
        stats: { ...prev.stats, timeElapsed: prev.stats.timeElapsed }
      }));
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}分 ${s}秒`;
  };

  const itemsPerPage = currentState.itemsPerPage;
  const filteredResults = useMemo(() => {
    return currentState.results.filter(r => {
      if (currentState.filterStatus === 'error' && !r.isError) return false;
      if (currentState.filterStatus === 'success' && r.isError) return false;
      if (currentState.filterProcessStatus !== 'all' && r.processStatus !== currentState.filterProcessStatus) return false;
      if (currentState.filterDiffStatus !== 'all' && r.diffStatus !== currentState.filterDiffStatus) return false;
      return true;
    }).sort((a, b) => {
      if (a.isError && !b.isError) return -1;
      if (!a.isError && b.isError) return 1;
      return 0;
    });
  }, [currentState.results, currentState.filterStatus, currentState.filterProcessStatus, currentState.filterDiffStatus]);

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = useMemo(() => {
    return filteredResults.slice((currentState.currentPage - 1) * itemsPerPage, currentState.currentPage * itemsPerPage);
  }, [filteredResults, currentState.currentPage, itemsPerPage]);

  const renderDiffBadge = (status?: 'new' | 'removed' | 'unchanged') => {
    switch (status) {
      case 'new':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">新增</span>;
      case 'removed':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">已移除</span>;
      case 'unchanged':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">未變更</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden relative">
      {/* Sidebar */}
      <div className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
          {isSidebarOpen && <span className="font-bold text-gray-800 truncate">功能區塊檢測</span>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors mx-auto"
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {isSidebarOpen && <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">檢測分頁</div>}
          <ul className="space-y-1 px-2">
            {SUB_PAGES.map(page => (
              <li key={page.id}>
                <button
                  onClick={() => {
                    setSelectedPage(page);
                    setSelectedResult(null);
                  }}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${selectedPage.id === page.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  title={page.name}
                >
                  <div className={`w-2 h-2 rounded-full mr-3 shrink-0 ${pageStates[page.id]?.inspectionState === 'loading' ? 'bg-amber-400 animate-pulse' :
                    pageStates[page.id]?.inspectionState === 'success' ? 'bg-green-500' :
                      pageStates[page.id]?.inspectionState === 'error' ? 'bg-red-500' :
                        selectedPage.id === page.id ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                  {isSidebarOpen && <span className="truncate">{page.name}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-blue-600">{selectedPage.name}</span>
            {currentState.lastRunTime && (
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200 ml-2">
                最後檢測：{new Date(currentState.lastRunTime).toLocaleString('zh-TW')}
              </span>
            )}
          </h1>

          <button
            onClick={startInspection}
            disabled={currentState.inspectionState === 'loading'}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentState.inspectionState === 'loading' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                檢測中...
              </>
            ) : (
              <>
                <Play size={18} />
                啟動檢測
              </>
            )}
          </button>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-lg text-blue-600"><ListChecks size={24} /></div>
                <div>
                  <div className="text-sm text-gray-500 font-medium mb-1">總檢測數</div>
                  <div className="text-2xl font-bold text-gray-900">{currentState.stats.total}</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-red-50 p-3 rounded-lg text-red-600"><AlertTriangle size={24} /></div>
                <div>
                  <div className="text-sm text-gray-500 font-medium mb-1">異常數</div>
                  <div className="text-2xl font-bold text-gray-900">{currentState.stats.errors}</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600"><Clock size={24} /></div>
                <div>
                  <div className="text-sm text-gray-500 font-medium mb-1">耗費時間</div>
                  <div className="text-2xl font-bold text-gray-900">{formatTime(currentState.stats.timeElapsed)}</div>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-medium text-gray-800 flex items-center gap-2">
                  <ListChecks size={18} className="text-blue-600" />
                  檢查事件清單
                </h3>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">狀態</span>
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                      <select
                        className="bg-transparent border-none text-sm focus:ring-0 text-gray-600 py-1.5 pl-3 pr-8 cursor-pointer"
                        value={currentState.filterStatus}
                        onChange={(e) => updatePageState(selectedPage.id, { filterStatus: e.target.value as any, currentPage: 1 })}
                      >
                        <option value="all">全部</option>
                        <option value="error">異常</option>
                        <option value="success">正常</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">差異比對</span>
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                      <select
                        className="bg-transparent border-none text-sm focus:ring-0 text-gray-600 py-1.5 pl-3 pr-8 cursor-pointer"
                        value={currentState.filterDiffStatus}
                        onChange={(e) => updatePageState(selectedPage.id, { filterDiffStatus: e.target.value as PageState['filterDiffStatus'], currentPage: 1 })}
                      >
                        <option value="all">全部</option>
                        <option value="new">新增</option>
                        <option value="removed">已移除</option>
                        <option value="unchanged">未變更</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">處理狀態</span>
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                      <select
                        className="bg-transparent border-none text-sm focus:ring-0 text-gray-600 py-1.5 pl-3 pr-8 cursor-pointer"
                        value={currentState.filterProcessStatus}
                        onChange={(e) => updatePageState(selectedPage.id, { filterProcessStatus: e.target.value as any, currentPage: 1 })}
                      >
                        <option value="all">全部</option>
                        <option value="待處理">待處理</option>
                        <option value="處理中">處理中</option>
                        <option value="已解決">已解決</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-white">
                      <th className="p-4 text-sm font-semibold text-gray-500">來源網址</th>
                      <th className="p-4 text-sm font-semibold text-gray-500">點擊標的</th>
                      <th className="p-4 text-sm font-semibold text-gray-500">狀態</th>
                      <th className="p-4 text-sm font-semibold text-gray-500">差異比對</th>
                      <th className="p-4 text-sm font-semibold text-gray-500">錯誤詳情</th>
                      <th className="p-4 text-sm font-semibold text-gray-500">處理狀態</th>
                      <th className="p-4 text-sm font-semibold text-gray-500 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentState.inspectionState === 'idle' && (
                      <tr className="border-b border-gray-50">
                        <td colSpan={7} className="p-8 text-center text-gray-400 text-sm">尚未執行檢測，請點擊上方「啟動檢測」</td>
                      </tr>
                    )}

                    {currentState.inspectionState === 'loading' && (
                      <>
                        {[1, 2, 3, 4, 5].map(i => (
                          <tr key={`skel-${i}`} className="border-b border-gray-50 animate-pulse">
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-36"></div></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                            <td className="p-4"><div className="h-5 bg-gray-200 rounded-full w-14"></div></td>
                            <td className="p-4"><div className="h-5 bg-gray-200 rounded-full w-16"></div></td>
                            <td className="p-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                            <td className="p-4"><div className="h-5 bg-gray-200 rounded w-14"></div></td>
                            <td className="p-4 text-center"><div className="h-5 bg-gray-200 rounded w-8 mx-auto"></div></td>
                          </tr>
                        ))}
                        <tr className="border-b border-gray-50">
                          <td colSpan={7} className="p-4 text-center text-blue-500 font-medium text-sm">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              系統探索中，請稍候...
                            </div>
                          </td>
                        </tr>
                      </>
                    )}

                    {currentState.inspectionState === 'error' && (
                      <tr className="border-b border-gray-50">
                        <td colSpan={7} className="p-8 text-center text-red-500 text-sm font-medium">
                          {currentState.errorMessage || '連線失敗'}
                        </td>
                      </tr>
                    )}

                    {currentState.inspectionState === 'success' && filteredResults.length === 0 && (
                      <tr className="border-b border-gray-50">
                        <td colSpan={7} className="p-8 text-center text-gray-500 text-sm font-medium">
                          沒有符合條件的檢測結果
                        </td>
                      </tr>
                    )}

                    {currentState.inspectionState === 'success' && paginatedResults.map((result) => (
                      <tr key={result.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-sm max-w-[200px]">
                          <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all line-clamp-2" title={result.sourceUrl}>
                            {result.sourceUrl}
                          </a>
                        </td>
                        <td className="p-4 text-sm text-gray-800 font-medium max-w-[200px] break-words whitespace-normal">
                          {result.target}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {result.isError ? (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                              異常
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-200">
                              正常
                            </span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {renderDiffBadge(result.diffStatus)}
                        </td>
                        <td className="p-4 text-sm max-w-[250px]">
                          {result.isError ? (
                            <span className="text-red-600 line-clamp-2" title={result.detail}>{result.detail}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {result.processStatus ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${result.processStatus === '待處理' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                              result.processStatus === '處理中' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                                'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}>
                              {result.processStatus}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setSelectedResult(result)}
                            className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="檢視詳情"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {currentState.inspectionState === 'success' && totalPages > 0 && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center items-center">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <span>每頁</span>
                      <select
                        className="bg-white border border-gray-300 text-gray-700 py-1 pl-2 pr-6 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm appearance-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.25rem center', backgroundSize: '1em' }}
                        value={currentState.itemsPerPage || 20}
                        onChange={(e) => updatePageState(selectedPage.id, { itemsPerPage: Number(e.target.value), currentPage: 1 })}
                      >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                      <span>筆，</span>
                    </div>

                    <span>第 {currentState.currentPage}/{totalPages} 頁，共 {filteredResults.length} 筆，</span>

                    <button
                      onClick={() => updatePageState(selectedPage.id, prev => ({ currentPage: Math.max(prev.currentPage - 1, 1) }))}
                      disabled={currentState.currentPage === 1}
                      className={`font-medium ${currentState.currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-teal-600 hover:text-teal-700 underline underline-offset-2'}`}
                    >
                      上一頁
                    </button>

                    <span className="text-gray-300 px-1">|</span>

                    <div className="flex items-center gap-1">
                      <span>跳至第</span>
                      <select
                        value={currentState.currentPage}
                        onChange={(e) => updatePageState(selectedPage.id, { currentPage: Number(e.target.value) })}
                        className="bg-white border border-gray-300 text-gray-700 py-1 pl-2 pr-6 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm appearance-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.25rem center', backgroundSize: '1em' }}
                      >
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <option key={page} value={page}>{page}</option>
                        ))}
                      </select>
                      <span>頁</span>
                    </div>

                    <span className="text-gray-300 px-1">|</span>

                    <button
                      onClick={() => updatePageState(selectedPage.id, prev => ({ currentPage: Math.min(prev.currentPage + 1, totalPages) }))}
                      disabled={currentState.currentPage === totalPages}
                      className={`font-medium ${currentState.currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-teal-600 hover:text-teal-700 underline underline-offset-2'}`}
                    >
                      下一頁
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* Drawer Overlay */}
      {selectedResult && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={() => setSelectedResult(null)}
        />
      )}

      {/* Drawer Panel */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${selectedResult ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ListChecks size={18} className="text-blue-600" />
            檢測詳情
          </h3>
          <button
            onClick={() => setSelectedResult(null)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {selectedResult && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">狀態</div>
              <div className="flex items-center gap-2">
                {selectedResult.isError ? (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">異常</span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-200">正常</span>
                )}
                {selectedResult.processStatus && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200">
                    {selectedResult.processStatus}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">點擊標的 (Target)</div>
              <div className="p-3 bg-gray-50 rounded-lg text-gray-800 font-medium break-words">
                {selectedResult.target}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">來源網址 (Source)</div>
              <a href={selectedResult.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                {selectedResult.sourceUrl}
              </a>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">目標網址 (Destination)</div>
              {selectedResult.destinationUrl.startsWith('http') ? (
                <a href={selectedResult.destinationUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                  {selectedResult.destinationUrl}
                </a>
              ) : (
                <div className="p-2 bg-gray-100 rounded text-sm text-gray-600 break-all">
                  {selectedResult.destinationUrl}
                </div>
              )}
            </div>

            {selectedResult.isError && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">錯誤詳情</div>
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 whitespace-pre-line text-sm font-mono">
                  {selectedResult.detail}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">檢測時間</div>
              <div className="text-sm text-gray-600">
                {new Date(selectedResult.timestamp).toLocaleString('zh-TW')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
