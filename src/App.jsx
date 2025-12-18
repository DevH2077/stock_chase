import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [symbol, setSymbol] = useState('RKLB') // 기본값: 로켓랩 (Rocket Lab)
  const [stockData, setStockData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  // 현재 가격 가져오기 (오류나 없으면 NULL 또는 0 반환)
  const getCurrentPrice = () => {
    if (!stockData || !stockData.price) {
      return null
    }
    const price = parseFloat(stockData.price)
    if (isNaN(price) || price === 0) {
      return null
    }
    return price
  }

  // 주식 가격 조회 (Yahoo Finance API 사용)
  const fetchStockPrice = async () => {
    if (!symbol.trim()) return

    setLoading(true)
    setError(null)

    try {
      // Yahoo Finance API 사용 (API 키 불필요)
      // CORS 프록시를 통해 요청
      const proxyUrl = 'https://api.allorigins.win/get?url='
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
      
      console.log('📡 API 요청:', symbol)
      
      const response = await fetch(proxyUrl + encodeURIComponent(yahooUrl))
      const data = await response.json()
      
      // 디버깅: API 응답 확인
      console.log('API 응답:', data)
      
      if (!data.contents) {
        setError('API 응답을 받을 수 없습니다. 잠시 후 다시 시도해주세요.')
        return
      }

      const yahooData = JSON.parse(data.contents)
      
      if (!yahooData.chart || !yahooData.chart.result || yahooData.chart.result.length === 0) {
        setError(`주식 정보를 찾을 수 없습니다. 심볼 "${symbol}"을(를) 확인해주세요.`)
        return
      }

      const result = yahooData.chart.result[0]
      const meta = result.meta
      const quote = result.indicators.quote[0]
      
      if (!meta || !quote) {
        setError('주식 데이터를 파싱할 수 없습니다.')
        return
      }

      // 시장 상태 확인 및 가격 결정
      const marketState = meta.marketState || 'REGULAR'
      const isAfterHours = marketState === 'POST' || marketState === 'POSTPOST'
      const isPreMarket = marketState === 'PRE' || marketState === 'PREPRE'
      const isClosed = marketState === 'CLOSED'
      
      // 현재 가격 결정: 에프터마켓 > 장중 > 프리마켓 > 전일 종가
      const currentPrice = meta.postMarketPrice || meta.regularMarketPrice || meta.preMarketPrice || meta.previousClose || 0
      const previousClose = meta.previousClose || currentPrice
      
      // 변화량 계산 (에프터마켓이면 에프터마켓 기준, 아니면 장중 기준)
      let change, changePercent
      if (isAfterHours && meta.postMarketPrice) {
        change = meta.postMarketPrice - previousClose
        changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0
      } else if (isPreMarket && meta.preMarketPrice) {
        change = meta.preMarketPrice - previousClose
        changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0
      } else {
        change = (meta.regularMarketPrice || currentPrice) - previousClose
        changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0
      }
      
      // 시장 상태 텍스트
      let marketStatus = '장중'
      if (isAfterHours) marketStatus = '에프터마켓'
      else if (isPreMarket) marketStatus = '프리마켓'
      else if (isClosed) marketStatus = '장마감'
      
      const stockInfo = {
        symbol: meta.symbol || symbol,
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        open: quote.open?.[0] || meta.regularMarketPrice || 0,
        high: Math.max(...(quote.high || [meta.regularMarketPrice || 0])),
        low: Math.min(...(quote.low || [meta.regularMarketPrice || 0])),
        volume: meta.regularMarketVolume || 0,
        lastTrade: new Date((meta.postMarketTime || meta.regularMarketTime || meta.preMarketTime || Date.now() / 1000) * 1000).toLocaleString('ko-KR'),
        previousClose: previousClose,
        marketStatus: marketStatus,
        isAfterHours: isAfterHours,
        isPreMarket: isPreMarket,
        isClosed: isClosed,
        regularMarketPrice: meta.regularMarketPrice,
        postMarketPrice: meta.postMarketPrice,
        preMarketPrice: meta.preMarketPrice
      }

      setStockData(stockInfo)
      console.log('✅ 주식 데이터 로드 성공:', stockInfo)
    } catch (err) {
      setError(`오류 발생: ${err.message}`)
      console.error('주식 조회 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  // 실시간 업데이트 시작/중지
  useEffect(() => {
    if (symbol) {
      // 즉시 한 번 조회
      fetchStockPrice()
      
      // 1분마다 업데이트 (무료 API 제한을 고려)
      intervalRef.current = setInterval(() => {
        fetchStockPrice()
      }, 60000) // 60초
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol])


  // 수동 새로고침
  const handleRefresh = () => {
    fetchStockPrice()
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📈 주식 모니터</h1>
        <p className="subtitle">실시간 주식 시세 확인</p>
      </header>

      <main className="app-main">
        <div className="search-section">
          <div className="input-group">
            <label htmlFor="symbol">주식 심볼:</label>
            <input
              id="symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="예: AAPL, TSLA, MSFT"
              className="symbol-input"
            />
            <button onClick={handleRefresh} disabled={loading} className="refresh-btn">
              {loading ? '로딩...' : '새로고침'}
            </button>
          </div>
          
          {/* 현재 가격 표시 태그 */}
          <div className="current-price-tag">
            <span className="price-label">현재 가격:</span>
            <span className="price-value">
              {getCurrentPrice() !== null 
                ? `$${getCurrentPrice().toFixed(2)}` 
                : error ? 'NULL' : '0'}
            </span>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {stockData && (
          <div className="stock-card">
            <div className="stock-header">
              <div>
                <h2>{stockData.symbol}</h2>
                <span className={`market-status ${stockData.isAfterHours ? 'after-hours' : stockData.isPreMarket ? 'pre-market' : stockData.isClosed ? 'closed' : 'regular'}`}>
                  {stockData.marketStatus}
                </span>
              </div>
              <div className="price-container">
                <span className={`price ${stockData.change >= 0 ? 'positive' : 'negative'}`}>
                  ${stockData.price.toFixed(2)}
                </span>
                <span className="price-unit">USD</span>
              </div>
            </div>
            
            <div className="stock-change">
              <span className={`change ${stockData.change >= 0 ? 'positive' : 'negative'}`}>
                {stockData.change >= 0 ? '↑' : '↓'} ${Math.abs(stockData.change).toFixed(2)} 
                ({Math.abs(stockData.changePercent).toFixed(2)}%)
              </span>
              {stockData.isAfterHours && stockData.regularMarketPrice && (
                <div className="regular-market-info">
                  <small>장중 종가: ${stockData.regularMarketPrice.toFixed(2)}</small>
                </div>
              )}
              {stockData.isPreMarket && stockData.previousClose && (
                <div className="regular-market-info">
                  <small>전일 종가: ${stockData.previousClose.toFixed(2)}</small>
                </div>
              )}
            </div>

            <div className="stock-details">
              <div className="detail-row">
                <span className="detail-label">시가:</span>
                <span className="detail-value">${stockData.open.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">고가:</span>
                <span className="detail-value">${stockData.high.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">저가:</span>
                <span className="detail-value">${stockData.low.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">거래량:</span>
                <span className="detail-value">{parseInt(stockData.volume).toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">전일 종가:</span>
                <span className="detail-value">${stockData.previousClose.toFixed(2)}</span>
              </div>
            </div>

            <div className="update-time">
              마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
            </div>
          </div>
        )}

        <div className="info-section">
          <h3>사용 방법</h3>
          <ol>
            <li>주식 심볼을 입력하세요 (예: AAPL, TSLA, MSFT 등)</li>
            <li>1분마다 자동으로 시세가 업데이트됩니다</li>
            <li>앱을 홈 화면에 추가하면 언제든지 빠르게 접근할 수 있습니다</li>
          </ol>
          
          <div className="api-note">
            <strong>API 정보:</strong> 이 앱은 <strong>Yahoo Finance API</strong>를 사용합니다. 
            API 키가 필요 없으며 무료로 사용할 수 있습니다.
            <br />
            <small>데이터 제공: Yahoo Finance | CORS 프록시: allorigins.win</small>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
