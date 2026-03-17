import React, { useState, useEffect } from 'react';
import { Menu, X, Play, ListChecks, AlertTriangle, Clock, ChevronLeft, ChevronRight, CheckCircle2, Filter, Eye } from 'lucide-react';

interface InspectResult {
  id: string;
  sourceUrl: string;
  destinationUrl: string;
  target: string;
  detail: string;
  processStatus: string;
  isError: boolean;
  timestamp: string;
}

const SUB_PAGES = [
  { id: 'home', name: '首頁', url: 'https://agrinetzero.moa.gov.tw/', subUrls: [] },
  { id: 'about', name: '認識農業淨零', url: 'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/Intro', subUrls: [
    'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/FourMain',
    'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/AgriGreenhouseGasInventory',
    'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/OperationFlagship',
    'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/NaturalCarbonSinkStrategy',
    'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/AgriCarbonReductionActions',
    'https://agrinetzero.moa.gov.tw/zh-TW/KnowFarmNetZero/NetZeroRegulations'
  ] },
  { id: 'calc', name: '農業碳排計算', url: 'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonEmissionAndCalculate/Intro', subUrls: [
    'https://agrinetzero.moa.gov.tw/zh-TW/CarbonFactor/List',
    'https://agrinetzero.moa.gov.tw/zh-TW/PcrSearch/List',
    'https://agrinetzero.moa.gov.tw/zh-TW/CarbonFootprintSearch/List',
    'https://agrinetzero.moa.gov.tw/zh-TW/SimpleCalculator/List'
  ] },
  { id: 'credit', name: '農業碳權', url: 'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Intro?CurrentTab=Intro', subUrls: [
    'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Intro?CurrentTab=IncrementalGreenhouseGasOffset',
    'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Intro?CurrentTab=GreenHouseVoluntaryReductionProject',
    'https://agrinetzero.moa.gov.tw/zh-TW/FarmCarbonRight/Regulations'
  ] },
  { id: 'energy', name: '農業綠能', url: 'https://agrinetzero.moa.gov.tw/zh-TW/Sge/About', subUrls: [
    'https://agrinetzero.moa.gov.tw/zh-TW/Sge/Regulations'
  ] },
  { id: 'circular', name: '循環農業', url: 'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/Intro', subUrls: [
    'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/About',
    'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/Info',
    'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/HowTo',
    'https://agrinetzero.moa.gov.tw/zh-TW/AgriCycle/Regulations'
  ] },
  { id: 'esg', name: 'ESG STORE', url: 'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Intro', subUrls: [
    'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/About',
    'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Mission',
    'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Match',
    'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/CustomService',
    'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/Cases',
    'https://agrinetzero.moa.gov.tw/zh-TW/EsgStore/FileDownload'
  ] },
  { id: 'info', name: '淨零資訊', url: 'https://agrinetzero.moa.gov.tw/zh-TW/News/List', subUrls: [
    'https://agrinetzero.moa.gov.tw/zh-TW/KnowledgeActivity/List'
  ] },
];

interface PageState {
  inspectionState: 'idle' | 'loading' | 'success' | 'error';
  results: InspectResult[];
  errorMessage: string;
  stats: { total: number; errors: number; timeElapsed: number };
  currentPage: number;
  filterStatus: 'all' | 'error' | 'success';
  filterProcessStatus: 'all' | '待處理' | '處理中' | '已解決';
}

const defaultPageState: PageState = {
  inspectionState: 'idle',
  results: [],
  errorMessage: '',
  stats: { total: 0, errors: 0, timeElapsed: 0 },
  currentPage: 1,
  filterStatus: 'all',
  filterProcessStatus: 'all',
};

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedPage, setSelectedPage] = useState(SUB_PAGES[0]);
  
  const [pageStates, setPageStates] = useState<Record<string, PageState>>({});
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedResult, setSelectedResult] = useState<InspectResult | null>(null);

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

  useEffect(() => {
    if (currentState.inspectionState === 'loading') {
      const startTime = Date.now() - (currentState.stats.timeElapsed * 1000);
      const interval = setInterval(() => {
        updatePageState(selectedPage.id, prev => ({
          stats: {
            ...prev.stats,
            timeElapsed: Math.floor((Date.now() - startTime) / 1000)
          }
        }));
      }, 1000);
      setTimer(interval);
      return () => clearInterval(interval);
    } else if (timer) {
      clearInterval(timer);
    }
  }, [currentState.inspectionState, selectedPage.id]);

  const startInspection = async () => {
    const pageId = selectedPage.id;
    updatePageState(pageId, {
      inspectionState: 'loading',
      results: [],
      errorMessage: '',
      stats: { total: 0, errors: 0, timeElapsed: 0 },
      currentPage: 1
    });
    setSelectedResult(null);

    try {
      const response = await fetch('/api/inspect-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: selectedPage.url, subUrls: selectedPage.subUrls || [] })
      });

      const data = await response.json();

      if (data.success) {
        updatePageState(pageId, {
          results: data.data,
          stats: {
            total: data.data.length,
            errors: data.data.filter((r: any) => r.isError).length,
            timeElapsed: getPageState(pageId).stats.timeElapsed
          },
          inspectionState: 'success'
        });
      } else {
        updatePageState(pageId, {
          errorMessage: data.message || '檢測失敗',
          inspectionState: 'error'
        });
      }
    } catch (error: any) {
      updatePageState(pageId, {
        errorMessage: error.message || '連線錯誤',
        inspectionState: 'error'
      });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}分 ${s}秒`;
  };

  const itemsPerPage = 20;
  const filteredResults = currentState.results.filter(r => {
    if (currentState.filterStatus === 'error' && !r.isError) return false;
    if (currentState.filterStatus === 'success' && r.isError) return false;
    if (currentState.filterProcessStatus !== 'all' && r.processStatus !== currentState.filterProcessStatus) return false;
    return true;
  }).sort((a, b) => {
    if (a.isError && !b.isError) return -1;
    if (!a.isError && b.isError) return 1;
    return 0;
  });

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = filteredResults.slice((currentState.currentPage - 1) * itemsPerPage, currentState.currentPage * itemsPerPage);

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
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                    selectedPage.id === page.id 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title={page.name}
                >
                  <div className={`w-2 h-2 rounded-full mr-3 shrink-0 ${selectedPage.id === page.id ? 'bg-blue-500' : 'bg-gray-300'}`} />
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
                      <th className="p-4 text-sm font-semibold text-gray-500">錯誤詳情</th>
                      <th className="p-4 text-sm font-semibold text-gray-500">處理狀態</th>
                      <th className="p-4 text-sm font-semibold text-gray-500 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentState.inspectionState === 'idle' && (
                      <tr className="border-b border-gray-50">
                        <td colSpan={6} className="p-8 text-center text-gray-400 text-sm">尚未執行檢測，請點擊上方「啟動檢測」</td>
                      </tr>
                    )}
                    
                    {currentState.inspectionState === 'loading' && (
                      <tr className="border-b border-gray-50">
                        <td colSpan={6} className="p-8 text-center text-blue-500 font-medium text-sm animate-pulse">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            系統深度探索中，請稍候...
                          </div>
                        </td>
                      </tr>
                    )}

                    {currentState.inspectionState === 'error' && (
                      <tr className="border-b border-gray-50">
                        <td colSpan={6} className="p-8 text-center text-red-500 text-sm font-medium">
                          {currentState.errorMessage || '連線失敗'}
                        </td>
                      </tr>
                    )}

                    {currentState.inspectionState === 'success' && filteredResults.length === 0 && (
                      <tr className="border-b border-gray-50">
                        <td colSpan={6} className="p-8 text-center text-gray-500 text-sm font-medium">
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
                        <td className="p-4 text-sm max-w-[250px]">
                          {result.isError ? (
                            <span className="text-red-600 line-clamp-2" title={result.detail}>{result.detail}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {result.processStatus ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              result.processStatus === '待處理' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
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
              {currentState.inspectionState === 'success' && totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    顯示第 {(currentState.currentPage - 1) * itemsPerPage + 1} 到 {Math.min(currentState.currentPage * itemsPerPage, filteredResults.length)} 筆，共 {filteredResults.length} 筆
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updatePageState(selectedPage.id, prev => ({ currentPage: Math.max(prev.currentPage - 1, 1) }))}
                      disabled={currentState.currentPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="上一頁"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    
                    <div className="flex items-center px-2 gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page, index, array) => {
                        // Show first, last, current, and adjacent pages
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentState.currentPage - 1 && page <= currentState.currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => updatePageState(selectedPage.id, { currentPage: page })}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                currentState.currentPage === page
                                  ? 'bg-blue-600 text-white border border-blue-600'
                                  : 'text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          (page === currentState.currentPage - 2 && page > 1) ||
                          (page === currentState.currentPage + 2 && page < totalPages)
                        ) {
                          return <span key={page} className="text-gray-400 px-1">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => updatePageState(selectedPage.id, prev => ({ currentPage: Math.min(prev.currentPage + 1, totalPages) }))}
                      disabled={currentState.currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="下一頁"
                    >
                      <ChevronRight size={18} />
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
