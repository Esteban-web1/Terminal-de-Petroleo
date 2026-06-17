<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Terminal de Petróleo</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#060810;--panel:#0e1018;--panel2:#13151f;--panel3:#191c28;
  --border:#1f2235;--border2:#2a2d40;
  --text:#e2e4f0;--text2:#9099b8;--text3:#4a5070;
  --green:#00e676;--green2:#00c853;--red:#ff4060;--red2:#ff1744;
  --yellow:#ffc300;--blue:#2979ff;--blue2:#82aaff;
  --orange:#ff6d00;--purple:#b388ff;
  --mono:'JetBrains Mono',monospace;--sans:'Inter',sans-serif;
}
html{font-size:13px}
body{background:var(--bg);color:var(--text);font-family:var(--sans);overflow-x:hidden;min-height:100vh}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:#2a2d40;border-radius:2px}
#bgCanvas{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
#app{position:relative;z-index:1;display:flex;flex-direction:column;min-height:100vh}
#topBar{position:sticky;top:0;z-index:100;background:rgba(6,8,16,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--border2)}
.tb-row1{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-bottom:1px solid var(--border)}
.tb-brand{display:flex;align-items:center;gap:10px}
.tb-logo{background:var(--orange);color:#000;font-family:var(--mono);font-weight:700;font-size:11px;padding:3px 9px;letter-spacing:2px}
.tb-title{font-family:var(--mono);font-size:11px;color:var(--text2);letter-spacing:2px}
.data-badge{font-size:9px;font-family:var(--mono);padding:1px 7px;letter-spacing:1px;border:1px solid}
.badge-sim{background:#1a1200;border-color:var(--yellow);color:var(--yellow)}
.badge-live{background:#001a08;border-color:var(--green);color:var(--green)}
.tb-clocks{display:flex}
.tb-clock{display:flex;flex-direction:column;align-items:center;padding:3px 11px;border-left:1px solid var(--border);min-width:78px}
.tc-city{font-family:var(--mono);font-size:8px;color:var(--text3);letter-spacing:1px}
.tc-time{font-family:var(--mono);font-size:12px;font-weight:600}
.tc-status{font-size:8px;font-family:var(--mono);margin-top:1px}
.tc-open{color:var(--green)}.tc-closed{color:var(--red)}
.tb-ticker{overflow:hidden;height:26px;background:#090b14;border-bottom:1px solid var(--border)}
.ticker-track{display:flex;align-items:center;height:100%;white-space:nowrap;animation:tickerScroll 50s linear infinite;width:max-content}
.ticker-track:hover{animation-play-state:paused}
@keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.ticker-item{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:11px;padding:0 12px;border-right:1px solid var(--border)}
.ti-name{color:var(--text3)}.ti-price{font-weight:600}
.price-up{color:var(--green)}.price-dn{color:var(--red)}.price-flat{color:var(--text2)}
.tab-nav{display:flex;background:var(--panel);border-bottom:2px solid var(--border2)}
.tab-btn{flex:1;background:none;border:none;color:var(--text3);font-family:var(--mono);font-size:11px;letter-spacing:.8px;padding:10px 0;cursor:pointer;transition:all .2s;border-bottom:2px solid transparent;margin-bottom:-2px;display:flex;align-items:center;justify-content:center;gap:7px}
.tab-btn:hover{color:var(--text2);background:var(--panel2)}
.tab-btn.active{color:var(--orange);border-bottom-color:var(--orange);background:var(--panel2)}
.tab-icon{font-size:13px}
#mainContent{flex:1}
.tab-section{display:none}
.tab-section.active{display:block}
.chart-controls{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;padding:8px 12px;background:var(--panel2);border-bottom:1px solid var(--border)}
.seg-group{display:flex;border:1px solid var(--border2)}
.seg-btn{background:none;border:none;border-right:1px solid var(--border);color:var(--text3);font-family:var(--mono);font-size:10px;padding:4px 9px;cursor:pointer;transition:all .12s;letter-spacing:.3px}
.seg-btn:last-child{border-right:none}
.seg-btn:hover{background:var(--panel3);color:var(--text2)}
.seg-btn.active{background:rgba(0,230,118,.1);color:var(--green);border-color:var(--green)}
.ind-bar{display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:6px 12px;background:var(--panel);border-bottom:1px solid var(--border)}
.ind-group-label{font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:.8px;margin-right:2px}
.ind-btn{background:none;border:1px solid var(--border);color:var(--text3);font-family:var(--mono);font-size:9px;padding:2px 7px;cursor:pointer;transition:all .12s;letter-spacing:.3px}
.ind-btn:hover{border-color:#444;color:var(--text2)}
.ind-btn.on{border-color:var(--yellow);color:var(--yellow);background:rgba(255,195,0,.08)}
.ind-btn.on-blue{border-color:var(--blue2);color:var(--blue2);background:rgba(130,170,255,.08)}
.ind-btn.on-purple{border-color:var(--purple);color:var(--purple);background:rgba(179,136,255,.08)}
.ind-btn.on-green{border-color:var(--green);color:var(--green);background:rgba(0,230,118,.08)}
.chart-wrap{position:relative;background:#060810}
#priceCanvas{display:block;width:100%;cursor:crosshair}
.ohlc-display{position:absolute;top:8px;left:12px;font-family:var(--mono);font-size:10px;pointer-events:none;display:flex;gap:14px;flex-wrap:wrap}
.ohlc-item{display:flex;gap:4px}
.ohlc-lbl{color:var(--text3)}.ohlc-val{font-weight:600}
.event-row{display:flex;gap:5px;padding:5px 12px;flex-wrap:wrap;border-top:1px solid var(--border);background:var(--panel2)}
.ev-chip{display:flex;align-items:center;gap:4px;font-size:9px;font-family:var(--mono);padding:2px 7px;border:1px solid transparent;letter-spacing:.3px}
.ev-war{background:#140306;border-color:#500;color:var(--red2)}
.ev-opec{background:#141000;border-color:#554400;color:var(--yellow)}
.ev-eia{background:#001018;border-color:#002840;color:var(--blue2)}
.ev-geo{background:#001410;border-color:#004025;color:#69f0ae}
#tab-news{display:none}
#tab-news.active{display:grid;grid-template-columns:1fr 340px;min-height:calc(100vh - 130px)}
.news-main{border-right:1px solid var(--border2);display:flex;flex-direction:column}
.news-hdr{padding:8px 12px;background:var(--panel2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.news-title{font-family:var(--mono);font-size:11px;color:var(--text2);letter-spacing:1px}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 1.5s ease-in-out infinite;display:inline-block;margin-right:5px}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}
.news-filters{padding:6px 10px;background:#0a0c15;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:5px}
.nf-row{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.nf-lbl{font-family:var(--mono);font-size:9px;color:var(--text3);min-width:50px}
.nf-btn{background:none;border:1px solid var(--border);color:var(--text3);font-family:var(--mono);font-size:9px;padding:2px 6px;cursor:pointer}
.nf-btn.on{background:var(--panel3);color:var(--text);border-color:#555}
.nf-high.on{border-color:var(--red);color:var(--red);background:#140006}
.nf-med.on{border-color:var(--yellow);color:var(--yellow);background:#141000}
.nf-low.on{border-color:var(--green);color:var(--green);background:#001408}
.news-list{flex:1;overflow-y:auto}
.news-item{padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s}
.news-item:hover{background:var(--panel2)}
.news-item.hi{border-left:2px solid var(--red);background:#0e0305}
.ni-meta{display:flex;align-items:center;gap:5px;margin-bottom:3px}
.ni-time{font-size:9px;color:var(--text3);font-family:var(--mono)}
.ni-src{font-size:9px;font-weight:700;letter-spacing:.4px}
.ni-impact{font-size:8px;padding:1px 4px;border:1px solid;font-family:var(--mono)}
.impact-high{border-color:var(--red);color:var(--red)}
.impact-med{border-color:var(--yellow);color:var(--yellow)}
.impact-low{border-color:var(--green);color:var(--green)}
.ni-headline{font-size:11px;line-height:1.5;color:var(--text)}
.ni-chg{font-size:10px;font-weight:700;font-family:var(--mono);margin-top:2px}
.news-sidebar{display:flex;flex-direction:column}
.ns-section{padding:10px 12px;border-bottom:1px solid var(--border2)}
.ns-title{font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:1px;margin-bottom:8px}
.price-card{background:var(--panel2);border:1px solid var(--border2);padding:10px 12px;margin-bottom:6px}
.pc-name{font-family:var(--mono);font-size:10px;color:var(--text2);margin-bottom:4px}
.pc-price{font-family:var(--mono);font-size:20px;font-weight:700}
.pc-chg{font-family:var(--mono);font-size:11px;margin-top:2px}
.metric-mini{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:10px}
.metric-mini:last-child{border:none}
.mm-lbl{color:var(--text2)}.mm-val{font-weight:600}
#tab-map{display:none}
#tab-map.active{display:flex;flex-direction:column;min-height:calc(100vh - 130px)}
.map-hdr{display:flex;align-items:center;justify-content:space-between;padding:7px 14px;background:var(--panel2);border-bottom:1px solid var(--border)}
.map-hdr-title{font-family:var(--mono);font-size:11px;color:var(--text2);letter-spacing:1px}
.map-toggle{display:flex;border:1px solid var(--border2)}
.mt-btn{background:none;border:none;border-right:1px solid var(--border2);color:var(--text3);font-family:var(--mono);font-size:10px;padding:4px 12px;cursor:pointer;transition:all .12s}
.mt-btn:last-child{border-right:none}
.mt-btn.active{background:rgba(41,121,255,.15);color:var(--blue2)}
.map-body{flex:1;display:grid;grid-template-columns:1fr 320px}
#mapView{position:relative;overflow:hidden;background:#030508}
#mapCanvas{display:block;width:100%;height:100%;min-height:420px}
.map-tooltip{position:absolute;background:var(--panel2);border:1px solid var(--border2);padding:10px 12px;font-family:var(--mono);font-size:10px;max-width:220px;pointer-events:none;z-index:10;display:none}
.map-tooltip.show{display:block}
.mt-country{font-size:12px;font-weight:700;color:var(--yellow);margin-bottom:6px}
.mt-row{display:flex;justify-content:space-between;gap:16px;margin-bottom:3px}
.mt-lbl{color:var(--text3)}.mt-val{color:var(--text)}
#listView{display:none;overflow-y:auto}
.prod-table{width:100%;font-family:var(--mono);font-size:10px;border-collapse:collapse}
.prod-table th{padding:7px 10px;background:var(--panel2);color:var(--text3);font-weight:500;text-align:left;font-size:9px;letter-spacing:.8px;border-bottom:1px solid var(--border2);position:sticky;top:0}
.prod-table td{padding:6px 10px;border-bottom:1px solid var(--border)}
.prod-table tr:hover td{background:var(--panel2)}
.status-stable{color:var(--green)}.status-tension{color:var(--yellow)}.status-conflict{color:var(--red)}.status-sanction{color:var(--purple)}
.prod-bar-bg{height:4px;background:var(--border);margin-top:3px;border-radius:2px}
.prod-bar-fill{height:100%;border-radius:2px}
.map-sidebar{border-left:1px solid var(--border2);display:flex;flex-direction:column;overflow-y:auto}
.ms-section{padding:10px 12px;border-bottom:1px solid var(--border2)}
.ms-title{font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:1px;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--border)}
.storage-card{background:var(--panel2);border:1px solid var(--border);padding:8px 10px;margin-bottom:5px}
.sc-hub{font-family:var(--mono);font-size:10px;color:var(--text2);margin-bottom:4px}
.sc-fill-bar{height:5px;background:var(--border);border-radius:3px;margin-bottom:4px}
.sc-fill-inner{height:100%;border-radius:3px}
.sc-stats{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--text3)}
.tanker-row{display:flex;flex-direction:column;gap:2px;padding:6px 0;border-bottom:1px solid var(--border)}
.tanker-row:last-child{border:none}
.tr-route{font-family:var(--mono);font-size:10px;color:var(--text2)}
.tr-meta{display:flex;gap:8px;font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:2px;flex-wrap:wrap}
.tr-status-normal{color:var(--green)}.tr-status-diverted{color:var(--red)}.tr-status-restricted{color:var(--yellow)}
#tab-analysis{display:none}
#tab-analysis.active{display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - 130px)}
.analysis-left{border-right:1px solid var(--border2);display:flex;flex-direction:column}
.analysis-right{display:flex;flex-direction:column}
.panel-hdr{padding:8px 14px;background:var(--panel2);border-bottom:1px solid var(--border);font-family:var(--mono);font-size:11px;color:var(--text2);letter-spacing:1px;display:flex;justify-content:space-between;align-items:center}
.digest-list{flex:1;overflow-y:auto;padding:10px 0}
.digest-item{padding:8px 14px;border-bottom:1px solid var(--border);display:flex;gap:10px}
.di-time{font-family:var(--mono);font-size:9px;color:var(--text3);min-width:38px;margin-top:2px}
.di-body{flex:1}
.di-impact{display:inline-block;font-size:8px;font-family:var(--mono);padding:1px 5px;border:1px solid;margin-bottom:4px}
.di-text{font-size:11px;line-height:1.5;color:var(--text)}
.di-tags{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}
.di-tag{font-family:var(--mono);font-size:8px;padding:1px 5px;background:var(--panel3);color:var(--text3);letter-spacing:.3px}
.proj-table{width:100%;font-family:var(--mono);font-size:10px;border-collapse:collapse}
.proj-table th{padding:7px 10px;background:var(--panel2);color:var(--text3);font-size:9px;letter-spacing:.8px;border-bottom:1px solid var(--border2);text-align:left;position:sticky;top:0}
.proj-table td{padding:6px 10px;border-bottom:1px solid var(--border)}
.proj-table tr:hover td{background:var(--panel2)}
.bias-bull{color:var(--green)}.bias-bear{color:var(--red)}.bias-neu{color:var(--text2)}
.sentiment-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px;border-top:1px solid var(--border2)}
.sent-card{background:var(--panel2);border:1px solid var(--border);padding:10px;text-align:center}
.sent-label{font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:.8px;margin-bottom:8px}
.sent-gauge{width:60px;height:60px;margin:0 auto 6px}
.sent-value{font-family:var(--mono);font-size:14px;font-weight:700}
.sent-desc{font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:2px}
@media(max-width:1100px){
  #tab-news.active{grid-template-columns:1fr}.news-sidebar{display:none}
  .map-body{grid-template-columns:1fr}.map-sidebar{display:none}
  #tab-analysis.active{grid-template-columns:1fr}.analysis-right{display:none}
}
@media(max-width:780px){.tb-clocks{display:none}.tab-btn span{display:none}}
</style>
</head>
<body>
<canvas id="bgCanvas"></canvas>
<div id="app">

<!-- TOPBAR -->
<div id="topBar">
  <div class="tb-row1">
    <div class="tb-brand">
      <div class="tb-logo">⛽</div>
      <div class="tb-title">TERMINAL DE PETRÓLEO</div>
      <span class="data-badge badge-sim" id="dataBadge">SIMULADO</span>
    </div>
    <div class="tb-clocks" id="clocksRow">
      <div class="tb-clock"><span class="tc-city">NUEVA YORK</span><span class="tc-time" id="clk-ny">--:--</span><span class="tc-status" id="st-ny"></span></div>
      <div class="tb-clock"><span class="tc-city">LONDON</span><span class="tc-time" id="clk-ldn">--:--</span><span class="tc-status" id="st-ldn"></span></div>
      <div class="tb-clock"><span class="tc-city">DUBAI</span><span class="tc-time" id="clk-dxb">--:--</span><span class="tc-status" id="st-dxb"></span></div>
      <div class="tb-clock"><span class="tc-city">SINGAPORE</span><span class="tc-time" id="clk-sgp">--:--</span><span class="tc-status" id="st-sgp"></span></div>
      <div class="tb-clock"><span class="tc-city">BUE. AIRES</span><span class="tc-time" id="clk-bue">--:--</span><span class="tc-status" id="st-bue"></span></div>
    </div>
    <div id="apiStatus" style="font-family:var(--mono);font-size:9px;color:var(--text3);text-align:right;line-height:1.8"></div>
  </div>
  <div class="tb-ticker"><div class="ticker-track" id="tickerTrack"></div></div>
  <nav class="tab-nav">
    <button class="tab-btn" id="tbn-charts" onclick="switchTab('charts')"><span class="tab-icon">📊</span><span>PRECIOS</span></button>
    <button class="tab-btn" id="tbn-news" onclick="switchTab('news')"><span class="tab-icon">📰</span><span>NOTICIAS</span></button>
    <button class="tab-btn" id="tbn-map" onclick="switchTab('map')"><span class="tab-icon">🗺</span><span>MAPA GLOBAL</span></button>
    <button class="tab-btn" id="tbn-analysis" onclick="switchTab('analysis')"><span class="tab-icon">🔍</span><span>ANÁLISIS 24H</span></button>
  </nav>
</div>

<div id="mainContent">
  <!-- ═══ TAB: PRECIOS ═══ -->
  <section id="tab-charts" class="tab-section">
    <div class="chart-controls">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div class="seg-group" id="assetSel">
          <button class="seg-btn active" onclick="selAsset('brent',this)">BRENT ICE</button>
          <button class="seg-btn" onclick="selAsset('wti',this)">WTI NYMEX</button>
          <button class="seg-btn" onclick="selAsset('coil',this)">COIL FUT</button>
          <button class="seg-btn" onclick="selAsset('ng',this)">NAT GAS</button>
          <button class="seg-btn" onclick="selAsset('spread',this)">BRENT-WTI</button>
        </div>
        <div class="seg-group" id="tfSel">
          <button class="seg-btn" onclick="selTF('1H',this)">1H</button>
          <button class="seg-btn" onclick="selTF('4H',this)">4H</button>
          <button class="seg-btn active" onclick="selTF('1D',this)">1D</button>
          <button class="seg-btn" onclick="selTF('1W',this)">1W</button>
          <button class="seg-btn" onclick="selTF('1M',this)">1M</button>
          <button class="seg-btn" onclick="selTF('3M',this)">3M</button>
          <button class="seg-btn" onclick="selTF('6M',this)">6M</button>
          <button class="seg-btn" onclick="selTF('1Y',this)">1Y</button>
          <button class="seg-btn" onclick="selTF('5Y',this)">5Y</button>
        </div>
      </div>
      <div id="priceTag" style="font-family:var(--mono);font-size:13px"></div>
    </div>
    <div class="ind-bar">
      <span class="ind-group-label">OVERLAY:</span>
      <button class="ind-btn" id="ib-sma20" onclick="toggleInd('sma20',this,'on')">SMA20</button>
      <button class="ind-btn" id="ib-sma50" onclick="toggleInd('sma50',this,'on')">SMA50</button>
      <button class="ind-btn" id="ib-sma200" onclick="toggleInd('sma200',this,'on')">SMA200</button>
      <button class="ind-btn" id="ib-ema20" onclick="toggleInd('ema20',this,'on')">EMA20</button>
      <button class="ind-btn" id="ib-bb" onclick="toggleInd('bb',this,'on')">BOLL. BANDS</button>
      <span style="width:1px;height:14px;background:var(--border2);margin:0 4px"></span>
      <span class="ind-group-label">SUB-PANEL:</span>
      <button class="ind-btn on-blue" id="ib-volume" onclick="toggleInd('volume',this,'on-blue')">VOLUMEN</button>
      <button class="ind-btn" id="ib-rsi" onclick="toggleInd('rsi',this,'on-green')">RSI(14)</button>
      <button class="ind-btn" id="ib-macd" onclick="toggleInd('macd',this,'on-purple')">MACD</button>
    </div>
    <div class="chart-wrap">
      <canvas id="priceCanvas" height="500"></canvas>
      <div class="ohlc-display" id="ohlcDisplay"></div>
    </div>
    <div class="event-row">
      <span style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-right:6px">EVENTOS:</span>
      <span class="ev-chip ev-war">🔴 GUERRA/CONFLICTO</span>
      <span class="ev-chip ev-opec">🟡 OPEC+ DECISIÓN</span>
      <span class="ev-chip ev-eia">🔵 EIA INVENTARIOS</span>
      <span class="ev-chip ev-geo">🟢 GEO-SUPPLY</span>
      <span style="margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--text3)">★ Hover sobre las velas para ver OHLCV</span>
    </div>
  </section>

  <!-- ═══ TAB: NOTICIAS ═══ -->
  <section id="tab-news" class="tab-section">
    <div class="news-main">
      <div class="news-hdr">
        <span class="news-title">NEWS FEED — TIEMPO REAL</span>
        <div style="display:flex;align-items:center;font-family:var(--mono);font-size:10px;color:var(--text3)">
          <span class="live-dot"></span>LIVE · <span id="newsCount">0</span> ITEMS
        </div>
      </div>
      <div class="news-filters">
        <div class="nf-row">
          <span class="nf-lbl">FUENTE</span>
          <button class="nf-btn on" onclick="filterNews('src','all',this)">ALL</button>
          <button class="nf-btn" onclick="filterNews('src','bloomberg',this)">BLG</button>
          <button class="nf-btn" onclick="filterNews('src','reuters',this)">RTR</button>
          <button class="nf-btn" onclick="filterNews('src','eia',this)">EIA</button>
          <button class="nf-btn" onclick="filterNews('src','opec',this)">OPEC</button>
          <button class="nf-btn" onclick="filterNews('src','ft',this)">FT</button>
          <button class="nf-btn" onclick="filterNews('src','platts',this)">PLTS</button>
        </div>
        <div class="nf-row">
          <span class="nf-lbl">CATEGORÍA</span>
          <button class="nf-btn on" onclick="filterNews('cat','all',this)">ALL</button>
          <button class="nf-btn" onclick="filterNews('cat','geo',this)">GEOPOLÍTICA</button>
          <button class="nf-btn" onclick="filterNews('cat','opec',this)">OPEC+</button>
          <button class="nf-btn" onclick="filterNews('cat','inv',this)">INVENTARIOS</button>
          <button class="nf-btn" onclick="filterNews('cat','prod',this)">PRODUCCIÓN</button>
          <button class="nf-btn" onclick="filterNews('cat','hormuz',this)">HORMUZ</button>
        </div>
        <div class="nf-row">
          <span class="nf-lbl">IMPACTO</span>
          <button class="nf-btn on" onclick="filterNews('imp','all',this)">ALL</button>
          <button class="nf-btn nf-high" onclick="filterNews('imp','high',this)">🔴 ALTO</button>
          <button class="nf-btn nf-med" onclick="filterNews('imp','med',this)">🟡 MEDIO</button>
          <button class="nf-btn nf-low" onclick="filterNews('imp','low',this)">🟢 BAJO</button>
        </div>
      </div>
      <div class="news-list" id="newsList"></div>
    </div>
    <div class="news-sidebar">
      <div class="ns-section"><div class="ns-title">COTIZACIONES CLAVE</div><div id="priceSidebar"></div></div>
      <div class="ns-section"><div class="ns-title">MÉTRICAS DE MERCADO</div><div id="metricsSidebar"></div></div>
    </div>
  </section>

  <!-- ═══ TAB: MAPA GLOBAL ═══ -->
  <section id="tab-map" class="tab-section">
    <div class="map-hdr">
      <span class="map-hdr-title">🌍 MAPA DE PRODUCCIÓN GLOBAL — RUTAS & ALMACENAMIENTO</span>
      <div style="display:flex;gap:10px;align-items:center">
        <div style="display:flex;gap:10px;font-family:var(--mono);font-size:9px">
          <span style="color:var(--green)">● ESTABLE</span><span style="color:var(--yellow)">● TENSIÓN</span>
          <span style="color:var(--red)">● CONFLICTO</span><span style="color:var(--purple)">● SANCIONADO</span>
        </div>
        <div class="map-toggle">
          <button class="mt-btn active" id="mt-map" onclick="setMapView('map')">🗺 MAPA</button>
          <button class="mt-btn" id="mt-list" onclick="setMapView('list')">☰ LISTADO</button>
        </div>
      </div>
    </div>
    <div class="map-body">
      <div id="mapView">
        <canvas id="mapCanvas"></canvas>
        <div class="map-tooltip" id="mapTooltip"></div>
      </div>
      <div id="listView">
        <table class="prod-table">
          <thead><tr><th>PAÍS</th><th>PRODUCCIÓN Mb/d</th><th>CAPACIDAD</th><th>%CAP</th><th>COMPAÑÍA</th><th>ESTADO</th></tr></thead>
          <tbody id="prodTableBody"></tbody>
        </table>
      </div>
      <div class="map-sidebar">
        <div class="ms-section"><div class="ms-title">NIVELES DE ALMACENAMIENTO</div><div id="storageCards"></div></div>
        <div class="ms-section"><div class="ms-title">RUTAS DE TANQUEROS</div><div id="tankerRoutes"></div></div>
      </div>
    </div>
  </section>

  <!-- ═══ TAB: ANÁLISIS 24H ═══ -->
  <section id="tab-analysis" class="tab-section">
    <div class="analysis-left">
      <div class="panel-hdr">
        <span>📋 DIGEST ÚLTIMAS 24H</span>
        <span id="aiStatus" style="font-size:9px;color:var(--text3)">IA: DESACTIVADA</span>
      </div>
      <div class="digest-list" id="digestList"></div>
      <div class="sentiment-row" id="sentimentRow"></div>
    </div>
    <div class="analysis-right">
      <div class="panel-hdr"><span>📈 PROYECCIONES DE ANALISTAS — BRENT USD/bbl</span></div>
      <div style="flex:1;overflow-y:auto">
        <table class="proj-table">
          <thead><tr><th>FUENTE</th><th>ANALISTA</th><th>Q3'25</th><th>Q4'25</th><th>H1'26</th><th>SESGO</th><th>FECHA</th></tr></thead>
          <tbody id="projTableBody"></tbody>
        </table>
      </div>
    </div>
  </section>
</div>
</div>

<script>

const S = {
  tab:'charts', asset:'brent', tf:'1D',
  ind:{sma20:false,sma50:false,sma200:false,ema20:false,bb:false,volume:true,rsi:false,macd:false},
  newsFilter:{src:'all',cat:'all',imp:'all'},
  mapView:'map', hover:-1,
  prices:{brent:74.38,wti:70.81,coil:71.42,ng:2.847,heatoil:2.118,rbob:2.264},
  changes:{brent:+0.57,wti:-0.46,coil:+0.25,ng:+1.10,heatoil:0,rbob:-0.40},
  chartData:null, liveActive:false
};

/* ── DATOS SIMULADOS ──────────────────────── */
const SEEDS={brent:{b:74.38,v:.9},wti:{b:70.81,v:.85},coil:{b:71.42,v:.88},ng:{b:2.847,v:.06},spread:{b:3.57,v:.15}};
const TF_CFG={'1H':{n:60,v:.18,d:0},'4H':{n:64,v:.28,d:0},'1D':{n:48,v:.35,d:-.001},'1W':{n:56,v:.55,d:-.002},'1M':{n:30,v:.9,d:.01},'3M':{n:65,v:1.1,d:.02},'6M':{n:130,v:1.4,d:.03},'1Y':{n:52,v:2.0,d:.05},'5Y':{n:60,v:3.5,d:.12}};
function genOHLC(base,n,vol,drift=0){
  const d=[];let last=base;
  for(let i=0;i<n;i++){const o=last,h=o+Math.random()*vol*1.5,l=o-Math.random()*vol*1.2,c=o+(Math.random()-.48)*vol+drift;
    last=c;d.push({o:+o.toFixed(2),h:+Math.max(h,o,c).toFixed(2),l:+Math.min(l,o,c).toFixed(2),c:+c.toFixed(2),v:Math.floor(60000+Math.random()*140000)});}
  return d;
}
function genLabels(tf,n){
  const l=[];const now=new Date();
  if(tf==='1H'||tf==='4H'){for(let i=n-1;i>=0;i--){const d=new Date(now-i*(tf==='1H'?3600000:14400000));l.push(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);}}
  else if(tf==='1D'){for(let i=n-1;i>=0;i--){const d=new Date(now-i*1800000);l.push(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);}}
  else{for(let i=n-1;i>=0;i--){const d=new Date(now-i*86400000);l.push(`${d.getDate()}/${d.getMonth()+1}`);}}
  return l;
}
function buildSimData(){
  const cfg=TF_CFG[S.tf]||TF_CFG['1D'],seed=SEEDS[S.asset]||SEEDS.brent;
  const ohlc=genOHLC(seed.b,cfg.n,seed.v,cfg.d),labels=genLabels(S.tf,cfg.n);
  return{ohlc,labels,closes:ohlc.map(d=>d.c),volumes:ohlc.map(d=>d.v)};
}

/* ── MATH ─────────────────────────────────── */
function smaArr(data,p){return data.map((_,i)=>{if(i<p-1)return null;return+(data.slice(i-p+1,i+1).reduce((s,v)=>s+v,0)/p).toFixed(3);});}
function emaArr(data,p){const k=2/(p+1),r=new Array(data.length).fill(null),s=p-1;r[s]=+(data.slice(0,p).reduce((a,b)=>a+b,0)/p).toFixed(3);for(let i=s+1;i<data.length;i++)r[i]=+(data[i]*k+r[i-1]*(1-k)).toFixed(3);return r;}
function calcBB(closes){const sm=smaArr(closes,20);return{sm,upper:closes.map((_,i)=>{if(i<19)return null;const sl=closes.slice(i-19,i+1),mn=sm[i];return+(mn+2*Math.sqrt(sl.reduce((s,v)=>s+(v-mn)**2,0)/20)).toFixed(3);}),lower:closes.map((_,i)=>{if(i<19)return null;const sl=closes.slice(i-19,i+1),mn=sm[i];return+(mn-2*Math.sqrt(sl.reduce((s,v)=>s+(v-mn)**2,0)/20)).toFixed(3);})};}
function calcRSI(closes,p=14){const r=new Array(closes.length).fill(null);if(closes.length<p+1)return r;let g=0,l=0;for(let i=1;i<=p;i++){const d=closes[i]-closes[i-1];if(d>0)g+=d;else l+=Math.abs(d);}let ag=g/p,al=l/p;r[p]=100-100/(1+ag/(al||.001));for(let i=p+1;i<closes.length;i++){const d=closes[i]-closes[i-1];ag=(ag*(p-1)+(d>0?d:0))/p;al=(al*(p-1)+(d<0?Math.abs(d):0))/p;r[i]=100-100/(1+ag/(al||.001));}return r;}
function calcMACD(closes){const fast=emaArr(closes,12),slow=emaArr(closes,26);const macd=closes.map((_,i)=>fast[i]!==null&&slow[i]!==null?+(fast[i]-slow[i]).toFixed(4):null);const valid=macd.filter(v=>v!==null);const offset=macd.length-valid.length;const sig=new Array(offset).fill(null).concat(emaArr(valid,9));const hist=macd.map((v,i)=>v!==null&&sig[i]!==null?+(v-sig[i]).toFixed(4):null);return{macd,sig,hist};}

/* ── CHART RENDERER ───────────────────────── */
function renderChart(){
  const canvas=document.getElementById('priceCanvas');if(!canvas)return;
  const dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const W=rect.width,H=rect.height;
  if(!S.chartData)S.chartData=buildSimData();
  const{ohlc,labels,closes,volumes}=S.chartData;
  const PAD={t:12,r:68,b:22,l:4},dW=W-PAD.l-PAD.r,totH=H-PAD.t-PAD.b;
  const subs=[];
  if(S.ind.volume)subs.push({k:'volume',ratio:.16});
  if(S.ind.rsi)subs.push({k:'rsi',ratio:.20});
  if(S.ind.macd)subs.push({k:'macd',ratio:.20});
  const subR=subs.reduce((s,p)=>s+p.ratio,0),mainH=totH*(1-subR);
  ctx.fillStyle='#060810';ctx.fillRect(0,0,W,H);
  drawMainZone(ctx,ohlc,labels,closes,{x:PAD.l,y:PAD.t,w:dW,h:mainH},PAD,W);
  let sy=PAD.t+mainH;
  for(const p of subs){
    const ph=totH*p.ratio,pz={x:PAD.l,y:sy+3,w:dW,h:ph-4};
    ctx.strokeStyle='#1f2235';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PAD.l,sy+1);ctx.lineTo(PAD.l+dW,sy+1);ctx.stroke();
    ctx.fillStyle='#4a5070';ctx.font='8px JetBrains Mono';ctx.textAlign='left';
    ctx.fillText({volume:'VOLUMEN',rsi:'RSI (14)',macd:'MACD (12,26,9)'}[p.k],PAD.l+2,sy+10);
    if(p.k==='volume')drawVolumeZone(ctx,volumes,ohlc,pz,PAD);
    if(p.k==='rsi')drawRSIZone(ctx,calcRSI(closes),pz,PAD);
    if(p.k==='macd'){const m=calcMACD(closes);drawMACDZone(ctx,m,pz,PAD);}
    sy+=ph;
  }
}
function drawMainZone(ctx,ohlc,labels,closes,z,PAD,W){
  const{x,y,w,h}=z;
  let maxP=Math.max(...ohlc.map(d=>d.h)),minP=Math.min(...ohlc.map(d=>d.l));
  const rng=maxP-minP;maxP+=rng*.06;minP-=rng*.06;
  const toY=p=>y+h-((p-minP)/(maxP-minP))*h,n=ohlc.length,cellW=w/n;
  const candleW=Math.max(1,cellW*.7),toX=i=>x+i*cellW+cellW*.5;
  for(let i=0;i<=8;i++){const p=minP+(i/8)*(maxP-minP),yy=toY(p);ctx.strokeStyle='rgba(255,255,255,.025)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+w,yy);ctx.stroke();ctx.fillStyle='#4a5070';ctx.font='9px JetBrains Mono';ctx.textAlign='left';ctx.fillText('$'+p.toFixed(2),x+w+4,yy+3);}
  if(S.ind.bb){const bb=calcBB(closes);ctx.fillStyle='rgba(255,109,0,.04)';ctx.beginPath();let s=false;bb.upper.forEach((v,i)=>{if(v===null)return;if(!s){ctx.moveTo(toX(i),toY(v));s=true;}else ctx.lineTo(toX(i),toY(v));});for(let i=bb.lower.length-1;i>=0;i--){if(bb.lower[i]===null)continue;ctx.lineTo(toX(i),toY(bb.lower[i]));}ctx.closePath();ctx.fill();[bb.upper,bb.lower].forEach(arr=>{ctx.strokeStyle='rgba(255,109,0,.45)';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();let s=false;arr.forEach((v,i)=>{if(v===null)return;if(!s){ctx.moveTo(toX(i),toY(v));s=true;}else ctx.lineTo(toX(i),toY(v));});ctx.stroke();ctx.setLineDash([]);});}
  ohlc.forEach((d,i)=>{
    const bull=d.c>=d.o,col=bull?'#00e676':'#ff4060',cx=toX(i);
    ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,toY(d.h));ctx.lineTo(cx,toY(d.l));ctx.stroke();
    const bt=toY(Math.max(d.o,d.c)),bb2=toY(Math.min(d.o,d.c)),bh=Math.max(1,bb2-bt),bx=cx-candleW/2;
    if(bull){ctx.strokeRect(bx,bt,candleW,bh);ctx.fillStyle='rgba(0,230,118,.15)';ctx.fillRect(bx,bt,candleW,bh);}
    else{ctx.fillStyle=col;ctx.fillRect(bx,bt,candleW,bh);}
  });
  [{k:'sma20',data:smaArr(closes,20),col:'#ffd600',lw:1.2},{k:'sma50',data:smaArr(closes,Math.min(50,closes.length)),col:'#82aaff',lw:1.3},{k:'sma200',data:smaArr(closes,Math.min(200,closes.length)),col:'#b388ff',lw:1.5},{k:'ema20',data:emaArr(closes,20),col:'#ff9100',lw:1.2}].forEach(ov=>{
    if(!S.ind[ov.k])return;ctx.strokeStyle=ov.col;ctx.lineWidth=ov.lw;ctx.beginPath();let st=false;
    ov.data.forEach((v,i)=>{if(v===null)return;if(!st){ctx.moveTo(toX(i),toY(v));st=true;}else ctx.lineTo(toX(i),toY(v));});ctx.stroke();
  });
  if(S.hover>=0&&S.hover<ohlc.length){
    const hx=toX(S.hover);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.moveTo(hx,y);ctx.lineTo(hx,y+h);ctx.stroke();
    const hy=toY(ohlc[S.hover].c);ctx.beginPath();ctx.moveTo(x,hy);ctx.lineTo(x+w,hy);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#1f2235';ctx.fillRect(x+w,hy-8,PAD.r-2,16);ctx.fillStyle='#e2e4f0';ctx.font='9px JetBrains Mono';ctx.textAlign='left';ctx.fillText('$'+ohlc[S.hover].c.toFixed(2),x+w+3,hy+3);
    const d=ohlc[S.hover],bull=d.c>=d.o;
    document.getElementById('ohlcDisplay').innerHTML=`<div class="ohlc-item"><span class="ohlc-lbl">O</span><span class="ohlc-val">$${d.o}</span></div><div class="ohlc-item"><span class="ohlc-lbl">H</span><span class="ohlc-val" style="color:var(--green)">$${d.h}</span></div><div class="ohlc-item"><span class="ohlc-lbl">L</span><span class="ohlc-val" style="color:var(--red)">$${d.l}</span></div><div class="ohlc-item"><span class="ohlc-lbl">C</span><span class="ohlc-val" style="color:${bull?'var(--green)':'var(--red)'}">$${d.c}</span></div><div class="ohlc-item"><span class="ohlc-lbl">VOL</span><span class="ohlc-val">${(d.v/1000).toFixed(0)}K</span></div><div class="ohlc-item"><span class="ohlc-lbl">LBL</span><span class="ohlc-val" style="color:var(--text3)">${labels[S.hover]}</span></div>`;
  } else document.getElementById('ohlcDisplay').innerHTML='';
  const step=Math.ceil(n/Math.min(12,n));ctx.fillStyle='#4a5070';ctx.font='9px JetBrains Mono';ctx.textAlign='center';
  for(let i=0;i<n;i+=step)ctx.fillText(labels[i],toX(i),y+h+14);
}
function drawVolumeZone(ctx,volumes,ohlc,z,PAD){
  const{x,y,w,h}=z,maxV=Math.max(...volumes),n=volumes.length,cellW=w/n,barW=Math.max(1,cellW*.7);
  volumes.forEach((v,i)=>{const bh=(v/maxV)*h*.9,bx=x+i*cellW+cellW*.5-barW/2,bull=ohlc[i].c>=ohlc[i].o;ctx.fillStyle=bull?'rgba(0,230,118,.4)':'rgba(255,64,96,.4)';ctx.fillRect(bx,y+h-bh,barW,bh);if(S.hover===i){ctx.fillStyle=bull?'rgba(0,230,118,.7)':'rgba(255,64,96,.7)';ctx.fillRect(bx,y+h-bh,barW,bh);}});
  ctx.fillStyle='#4a5070';ctx.font='9px JetBrains Mono';ctx.textAlign='left';ctx.fillText((Math.max(...volumes)/1000).toFixed(0)+'K',z.x+z.w+4,z.y+10);
}
function drawRSIZone(ctx,rsi,z,PAD){
  const{x,y,w,h}=z,n=rsi.length,cellW=w/n,toX=i=>x+i*cellW+cellW*.5,toY=v=>y+h-((v)/100)*h;
  ctx.fillStyle='rgba(255,64,96,.06)';ctx.fillRect(x,toY(70),w,h-toY(70));
  ctx.fillStyle='rgba(0,230,118,.06)';ctx.fillRect(x,y,w,toY(70)-toY(100)+toY(30));
  [70,50,30].forEach(lvl=>{ctx.strokeStyle=lvl===50?'rgba(255,255,255,.06)':'rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.setLineDash(lvl===50?[]:[3,4]);ctx.beginPath();ctx.moveTo(x,toY(lvl));ctx.lineTo(x+w,toY(lvl));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#4a5070';ctx.font='8px JetBrains Mono';ctx.textAlign='left';ctx.fillText(lvl,x+w+4,toY(lvl)+3);});
  ctx.strokeStyle='#00e676';ctx.lineWidth=1.5;ctx.beginPath();let st=false;rsi.forEach((v,i)=>{if(v===null)return;if(!st){ctx.moveTo(toX(i),toY(v));st=true;}else ctx.lineTo(toX(i),toY(v));});ctx.stroke();
  const last=rsi.filter(v=>v!==null).pop();if(last){ctx.fillStyle='#1f2235';ctx.fillRect(x+w,toY(last)-8,PAD.r-2,16);ctx.fillStyle=last>70?'#ff4060':last<30?'#00e676':'#9099b8';ctx.font='9px JetBrains Mono';ctx.textAlign='left';ctx.fillText(last.toFixed(1),x+w+3,toY(last)+3);}
}
function drawMACDZone(ctx,{macd,sig,hist},z,PAD){
  const{x,y,w,h}=z,n=macd.length,vals=[...hist,...macd,...sig].filter(v=>v!==null),maxV=Math.max(...vals.map(Math.abs))*1.1,midY=y+h/2;
  const toY=v=>midY-(v/maxV)*(h/2),cellW=w/n,toX=i=>x+i*cellW+cellW*.5,bW=Math.max(1,cellW*.65);
  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,midY);ctx.lineTo(x+w,midY);ctx.stroke();
  hist.forEach((v,i)=>{if(v===null)return;const top=toY(v),bot=midY;ctx.fillStyle=v>=0?'rgba(0,230,118,.5)':'rgba(255,64,96,.5)';ctx.fillRect(toX(i)-bW/2,Math.min(top,bot),bW,Math.abs(top-bot)||1);});
  [[macd,'#82aaff',1.5],[sig,'#ffc300',1]].forEach(([arr,col,lw])=>{ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.beginPath();let st=false;arr.forEach((v,i)=>{if(v===null)return;if(!st){ctx.moveTo(toX(i),toY(v));st=true;}else ctx.lineTo(toX(i),toY(v));});ctx.stroke();});
}

/* ── MOUSE EVENTS ─────────────────────────── */
function initChartMouse(){
  const canvas=document.getElementById('priceCanvas');
  canvas.onmousemove=e=>{if(!S.chartData)return;const rect=canvas.getBoundingClientRect(),mouseX=e.clientX-rect.left,dW=rect.width-72,n=S.chartData.ohlc.length,idx=Math.max(0,Math.min(n-1,Math.floor((mouseX-4)/(dW/n))));if(idx!==S.hover){S.hover=idx;renderChart();}};
  canvas.onmouseleave=()=>{if(S.hover!==-1){S.hover=-1;renderChart();}};
}

/* ═══════════════════════════════════════════════
   API 1 — TWELVE DATA (precios y velas reales)
   Se activa si twelvedata no está vacío arriba
═══════════════════════════════════════════════ */
const TD_SYM_MAP={brent:'BRENT/USD',wti:'WTI/USD',ng:'XNG/USD',coil:'WTI/USD'};
const TD_TF_MAP={'1H':'1h','4H':'4h','1D':'1day','1W':'1week','1M':'1month','3M':'1month','6M':'1month','1Y':'1month','5Y':'1month'};
async function fetchTwelveDataPrices(){  try{
    const syms=['BRENT/USD','WTI/USD','XNG/USD'];
    const url = `/api/prices?mode=spot`;
    const r=await fetch(url);const d=await r.json();
    if(d['BRENT/USD']?.price){S.prices.brent=parseFloat(d['BRENT/USD'].price);S.prices.coil=S.prices.brent-2.96;}
    if(d['WTI/USD']?.price)S.prices.wti=parseFloat(d['WTI/USD'].price);
    if(d['XNG/USD']?.price)S.prices.ng=parseFloat(d['XNG/USD'].price);
    setBadgeLive('TwelveData ✓');
    console.log('[TwelveData] Precios actualizados:',S.prices);
  }catch(e){console.warn('[TwelveData Error]',e);}
}
async function loadRealCandles(){  const sym=TD_SYM_MAP[S.asset];if(!sym)return;
  const interval=TD_TF_MAP[S.tf]||'1day';
  try{
    const url = `/api/prices?mode=candles&symbol=${encodeURIComponent(sym)}&interval=${interval}&outputsize=150`;
    const r=await fetch(url);const d=await r.json();
    if(d.values&&d.values.length>0){
      const candles=[...d.values].reverse();
      S.chartData={
        ohlc:candles.map(b=>({o:parseFloat(b.open),h:parseFloat(b.high),l:parseFloat(b.low),c:parseFloat(b.close),v:parseInt(b.volume||50000)})),
        labels:candles.map(b=>b.datetime.length>10?b.datetime.slice(5,16):b.datetime.slice(5,10)),
        closes:candles.map(b=>parseFloat(b.close)),
        volumes:candles.map(b=>parseInt(b.volume||50000))
      };
      renderChart();
      console.log(`[TwelveData] Velas reales cargadas: ${candles.length} barras ${interval} para ${sym}`);
    }
  }catch(e){console.warn('[TwelveData OHLCV Error]',e);}
}

/* ═══════════════════════════════════════════════
   API 2 — EIA (inventarios semanales EE.UU.)
   Se activa si eia no está vacío arriba
═══════════════════════════════════════════════ */
async function fetchEIAInventories(){  try{
    const url = `/api/eia-data`;
    const r=await fetch(url);const d=await r.json();
    if(d.response?.data){
      const latest=d.response.data[0];
      const prev=d.response.data[1];
      const change=latest&&prev?+(latest.value-prev.value).toFixed(1):null;
      // Actualizar la tarjeta de Cushing en la tabla de storage
      STORAGE_DATA[1].level=+(latest?.value/1000).toFixed(1)||442.7;
      if(change!==null){STORAGE_DATA[1].chg=change;console.log(`[EIA] Inventarios crudo: ${latest.value} Mbl (Δ${change})`);}
      addStatusChip('EIA ✓');
    }
  }catch(e){console.warn('[EIA Error]',e);}
}

/* ═══════════════════════════════════════════════
   API 3 — GNEWS (noticias petróleo, sin backend)
   Se activa si gnews no está vacío arriba
═══════════════════════════════════════════════ */
async function fetchGNews(){  try{
    const query=encodeURIComponent('crude oil OPEC Brent WTI petroleum');
    const url = `/api/news-gnews?q=${query}&lang=en&max=10`;
    const r=await fetch(url);const d=await r.json();
    if(d.articles&&d.articles.length>0){
      const srcColors={'Reuters':'#ff9100','Bloomberg':'#2979ff','CNBC':'#00e676','Financial Times':'#ff5252'};
      d.articles.forEach((a,i)=>{
        const srcName=a.source?.name||'GNEWS';
        NEWS.unshift({
          id:Date.now()+i,
          ts:new Date(a.publishedAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false}),
          src:'gnews',srcL:srcName.substring(0,12).toUpperCase(),
          srcColor:srcColors[srcName]||'#9099b8',
          impact:Math.random()>.6?'high':'med',
          cat:a.title.toLowerCase().includes('opec')?'opec':a.title.toLowerCase().includes('iran')||a.title.toLowerCase().includes('hormuz')?'geo':'prod',
          hl:a.title,hi:false,chg:'',url:a.url
        });
      });
      if(NEWS.length>60)NEWS.splice(60);
      if(S.tab==='news')renderNews();
      addStatusChip('GNews ✓');
      console.log(`[GNews] ${d.articles.length} noticias cargadas`);
    }
  }catch(e){console.warn('[GNews Error]',e);}
}

/* ═══════════════════════════════════════════════
   API 4 — NEWSAPI (Reuters/Bloomberg — necesita
   backend proxy en producción, funciona en local)
   Se activa si newsapi no está vacío arriba
═══════════════════════════════════════════════ */
async function fetchNewsAPI(){  try{
    // En localhost funciona directo. En producción (GitHub Pages/Netlify)
    // necesitás la Netlify Function del backend-guide.md
    // Cambiá la URL a '/api/news' cuando uses Netlify
    const url = `/api/news-newsapi?q=crude+oil+OPEC+Brent+WTI`;
    const r=await fetch(url);const d=await r.json();
    if(d.articles){
      d.articles.forEach((a,i)=>{
        NEWS.unshift({
          id:Date.now()+1000+i,
          ts:new Date(a.publishedAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false}),
          src:'newsapi',srcL:(a.source?.name||'NEWS').substring(0,12).toUpperCase(),
          srcColor:'#ff9100',impact:'med',cat:'prod',hl:a.title,hi:false,chg:'',url:a.url
        });
      });
      if(NEWS.length>60)NEWS.splice(60);
      if(S.tab==='news')renderNews();
      addStatusChip('NewsAPI ✓');
      console.log(`[NewsAPI] ${d.articles.length} noticias cargadas`);
    }
  }catch(e){console.warn('[NewsAPI Error — en producción necesita proxy]',e);}
}

/* ═══════════════════════════════════════════════
   API 5 — ALPHA VANTAGE (histórico largo plazo)
   Se activa si alphavantage no está vacío arriba
═══════════════════════════════════════════════ */
const AV_FN_MAP={brent:'BRENT',wti:'WTI',ng:'NATURAL_GAS'};
async function fetchAlphaVantage(){  const fn=AV_FN_MAP[S.asset];
  if(!fn)return;
  // Solo para temporalidades largas
  if(!['1Y','5Y','3M','6M'].includes(S.tf))return;
  const interval=S.tf==='5Y'?'monthly':S.tf==='1Y'?'weekly':'monthly';
  try{
    const url = `/api/prices-alpha?function=${fn}&interval=${interval}`;
    const r=await fetch(url);const d=await r.json();
    if(d.data&&d.data.length>0){
      const limit=S.tf==='5Y'?60:S.tf==='1Y'?52:S.tf==='6M'?26:13;
      const slice=d.data.slice(0,limit).reverse();
      S.chartData={
        ohlc:slice.map(b=>({o:parseFloat(b.value),h:parseFloat(b.value)*1.005,l:parseFloat(b.value)*.995,c:parseFloat(b.value),v:80000})),
        labels:slice.map(b=>b.date.slice(0,7)),
        closes:slice.map(b=>parseFloat(b.value)),
        volumes:slice.map(()=>80000)
      };
      renderChart();
      addStatusChip('AlphaVantage ✓');
      console.log(`[AlphaVantage] ${slice.length} barras ${fn} ${interval}`);
    }
  }catch(e){console.warn('[AlphaVantage Error]',e);}
}

/* ═══════════════════════════════════════════════
   API 6 — WORLD BANK (producción por país, sin key)
   Siempre activa — no necesita key
═══════════════════════════════════════════════ */
async function fetchWorldBank(){
  try{
    // Renta del petróleo como % del PBI por país — proxy de producción
    const url='https://api.worldbank.org/v2/country/US;SA;RU;CA;IQ;IR;BR;AE;KW;NO;MX;NG;LY/indicator/NY.GDP.PETR.RT.ZS?format=json&per_page=30&mrv=1';
    const r=await fetch(url);const d=await r.json();
    if(d[1]){
      d[1].forEach(item=>{
        if(!item.value)return;
        const found=PROD_DATA.find(p=>p.wb_code&&p.wb_code===item.countryiso3code);
        if(found)found.wb_oil_pct=item.value.toFixed(1);
      });
      console.log('[WorldBank] Datos de renta petrolera actualizados');
    }
  }catch(e){console.warn('[WorldBank Error]',e);}
}

/* ═══════════════════════════════════════════════
   API 7 — ANTHROPIC CLAUDE (resumen IA de noticias)
   Se activa si anthropic no está vacío arriba
   ⚠️  SOLO USAR EN LOCAL — expone key en navegador
   Para producción: usar backend proxy (backend-guide.md)
═══════════════════════════════════════════════ */
async function fetchAISummary(){  const headlines=NEWS.slice(0,8).map(n=>n.hl);
  if(!headlines.length)return;
  document.getElementById('aiStatus').textContent='IA: ANALIZANDO...';
  document.getElementById('aiStatus').style.color='var(--yellow)';
  try{
    const r = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ headlines: headlines })
    });
    const d=await r.json();
    if(d.content?.[0]?.text){
      const summary=d.content[0].text;
      const lines=summary.split('\n').filter(l=>l.trim());
      const items=lines.map(line=>({t:'IA',imp:'med',text:line,tags:['ia','análisis']}));
      // Insertar al inicio del digest
      items.reverse().forEach(item=>DIGEST.unshift(item));
      if(S.tab==='analysis')renderAnalysis();
      document.getElementById('aiStatus').textContent='IA: ACTIVA ✓';
      document.getElementById('aiStatus').style.color='var(--green)';
      console.log('[Claude AI] Resumen generado');
    }
  }catch(e){
    console.warn('[Anthropic Error]',e);
    document.getElementById('aiStatus').textContent='IA: ERROR';
    document.getElementById('aiStatus').style.color='var(--red)';
  }
}

/* ── STATUS CHIPS ─────────────────────────── */
function setBadgeLive(src){
  const badge=document.getElementById('dataBadge');
  badge.textContent='LIVE';badge.className='data-badge badge-live';
  S.liveActive=true;addStatusChip(src);
}
function addStatusChip(txt){
  const el=document.getElementById('apiStatus');
  if(!el.textContent.includes(txt))el.textContent+=(el.textContent?'  ':'')+txt;
}

/* ── NEWS DATA & RENDER ───────────────────── */
const NEWS=[
  {id:1,ts:'14:32',src:'reuters',srcL:'REUTERS',srcColor:'#ff9100',impact:'high',cat:'geo',hl:'Irán amenaza cierre del Estrecho de Hormuz si EE.UU. amplía sanciones — funcionario IRGC',hi:true,chg:'+1.8%'},
  {id:2,ts:'14:18',src:'bloomberg',srcL:'BLOOMBERG',srcColor:'#2979ff',impact:'high',cat:'opec',hl:'Arabia Saudita extiende recorte voluntario 1 Mb/d hasta Q4 2025, confirma OPEC+',hi:false,chg:'+0.9%'},
  {id:3,ts:'13:55',src:'eia',srcL:'EIA',srcColor:'#2979ff',impact:'high',cat:'inv',hl:'EIA: variación semanal crudo -2.147M bbl vs consenso -1.4M. Cushing en mínimo de 8 meses',hi:false,chg:'+1.2%'},
  {id:4,ts:'13:30',src:'cnbc',srcL:'CNBC',srcColor:'#00e676',impact:'med',cat:'prod',hl:'Producción shale EE.UU. sube a 13.3 Mb/d en mayo — Baker Hughes: rigs +3 a 480',hi:false,chg:'-0.3%'},
  {id:5,ts:'12:47',src:'ft',srcL:'FT',srcColor:'#ff5252',impact:'med',cat:'geo',hl:'Tanquero ruso desvía ruta por zona de embargo báltico — descuento de Urals se amplía',hi:false,chg:'-0.5%'},
  {id:6,ts:'12:20',src:'platts',srcL:'S&P PLATTS',srcColor:'#b388ff',impact:'high',cat:'hormuz',hl:'3 tanqueros reportan spoofing GPS cerca del Estrecho de Hormuz — alerta marítima emitida',hi:true,chg:'+2.1%'},
  {id:7,ts:'11:58',src:'opec',srcL:'OPEC',srcColor:'#ffc300',impact:'med',cat:'opec',hl:'OPEC+ JMMC se reúne el 3 de agosto — revisión de cumplimiento de cuotas en agenda',hi:false,chg:'0.0%'},
  {id:8,ts:'11:30',src:'reuters',srcL:'REUTERS',srcColor:'#ff9100',impact:'low',cat:'prod',hl:'Noruega: producción llega a 1.92 Mb/d en mayo — Johan Sverdrup supera pronóstico',hi:false,chg:'+0.1%'},
  {id:9,ts:'10:55',src:'bloomberg',srcL:'BLOOMBERG',srcColor:'#2979ff',impact:'med',cat:'geo',hl:'China impone nuevas restricciones de envío a crudos venezolanos — ban extendido',hi:false,chg:'-0.4%'},
  {id:10,ts:'10:22',src:'eia',srcL:'EIA',srcColor:'#2979ff',impact:'low',cat:'inv',hl:'EIA STEO: producción crudo EE.UU. revisada al alza a 13.6 Mb/d para 2025',hi:false,chg:'-0.2%'},
  {id:11,ts:'09:45',src:'ft',srcL:'FT',srcColor:'#ff5252',impact:'high',cat:'geo',hl:'Misil Houthi impacta tanquero en Mar Rojo — riesgo Bab el-Mandeb elevado a CRÍTICO',hi:true,chg:'+1.5%'},
  {id:12,ts:'09:10',src:'cnbc',srcL:'CNBC',srcColor:'#00e676',impact:'med',cat:'prod',hl:'ExxonMobil Guyana alcanza 650 kbd — tercer FPSO avant de plazo previsto',hi:false,chg:'-0.3%'},
  {id:13,ts:'08:30',src:'platts',srcL:'S&P PLATTS',srcColor:'#b388ff',impact:'low',cat:'opec',hl:'UAE OSP octubre: Murban $74.75/bbl, +$1.10 vs septiembre — señal de demanda asiática',hi:false,chg:'+0.2%'},
  {id:14,ts:'08:00',src:'reuters',srcL:'REUTERS',srcColor:'#ff9100',impact:'med',cat:'hormuz',hl:'Irán incauta tanquero de bandera Marshall Islands en el Golfo — 3ro en 2 meses',hi:true,chg:'+1.9%'},
  {id:15,ts:'07:15',src:'bloomberg',srcL:'BLOOMBERG',srcColor:'#2979ff',impact:'low',cat:'prod',hl:'IEA: superávit global de oferta de 0.6 Mb/d en H2 2025 — perspectiva bajista de demanda',hi:false,chg:'-0.8%'},
];
function renderNews(){
  const f=S.newsFilter;
  const filtered=NEWS.filter(n=>(f.src==='all'||n.src===f.src||n.srcL.toLowerCase().includes(f.src))&&(f.cat==='all'||n.cat===f.cat)&&(f.imp==='all'||n.impact===f.imp));
  document.getElementById('newsCount').textContent=filtered.length;
  document.getElementById('newsList').innerHTML=filtered.map(n=>`
    <div class="news-item${n.hi?' hi':''}" ${n.url?`onclick="window.open('${n.url}','_blank')"`:''}>
      <div class="ni-meta"><span class="ni-time">${n.ts}</span><span class="ni-src" style="color:${n.srcColor||'#9099b8'}">${n.srcL}</span><span class="ni-impact impact-${n.impact}">${n.impact.toUpperCase()}</span></div>
      <div class="ni-headline">${n.hl}</div>
      ${n.chg?`<div class="ni-chg" style="color:${n.chg.startsWith('+')?'var(--green)':n.chg.startsWith('-')?'var(--red)':'var(--text3)'}">${n.chg}</div>`:''}
    </div>`).join('');
}
function filterNews(type,val,btn){
  S.newsFilter[type]=val;
  btn.closest('.nf-row').querySelectorAll('.nf-btn').forEach(b=>b.classList.remove('on','nf-high','nf-med','nf-low'));
  btn.classList.add('on');renderNews();
}
function renderNewsSidebar(){
  document.getElementById('priceSidebar').innerHTML=[{name:'BRENT ICE',key:'brent'},{name:'WTI NYMEX',key:'wti'},{name:'NAT GAS',key:'ng'},{name:'RBOB GAS',key:'rbob'}].map(p=>{
    const price=S.prices[p.key],chg=S.changes[p.key]||0;
    return`<div class="price-card"><div class="pc-name">${p.name}</div><div class="pc-price" style="color:${chg>0?'var(--green)':chg<0?'var(--red)':'var(--text)'}">$${price}</div><div class="pc-chg" style="color:${chg>0?'var(--green)':chg<0?'var(--red)':'var(--text2)'}">${chg>0?'▲':'▼'} ${Math.abs(chg).toFixed(2)}%</div></div>`;
  }).join('');
  document.getElementById('metricsSidebar').innerHTML=[{l:'Brent-WTI Spread',v:'+$3.57'},{l:'Cushing Stocks',v:'22.3 Mbl ▼'},{l:'OECD Days Cover',v:'61.3 days'},{l:'Refinery Util. USA',v:'91.4%'},{l:'Baker Hughes Rigs',v:'480 +3'},{l:'OPEC+ Compliance',v:'92.4%'}].map(m=>`<div class="metric-mini"><span class="mm-lbl">${m.l}</span><span class="mm-val">${m.v}</span></div>`).join('');
}

/* ── MAP DATA & RENDER ────────────────────── */
const PROD_DATA=[
  {country:'EE.UU.',flag:'🇺🇸',prod:13.3,cap:14.0,pct:95,lon:-97,lat:38,status:'stable',company:'ExxonMobil / Chevron',wb_code:'USA'},
  {country:'Arabia Saudita',flag:'🇸🇦',prod:9.0,cap:12.0,pct:75,lon:45,lat:24,status:'stable',company:'Saudi Aramco',wb_code:'SAU'},
  {country:'Rusia',flag:'🇷🇺',prod:9.2,cap:11.5,pct:80,lon:60,lat:58,status:'sanction',company:'Rosneft / Lukoil',wb_code:'RUS'},
  {country:'Canadá',flag:'🇨🇦',prod:5.8,cap:6.5,pct:89,lon:-110,lat:56,status:'stable',company:'Suncor / CNR',wb_code:'CAN'},
  {country:'Irak',flag:'🇮🇶',prod:4.3,cap:5.0,pct:86,lon:44,lat:33,status:'tension',company:'INOC / BP / Shell',wb_code:'IRQ'},
  {country:'Irán',flag:'🇮🇷',prod:3.5,cap:5.0,pct:70,lon:53,lat:32,status:'sanction',company:'NIOC',wb_code:'IRN'},
  {country:'Brasil',flag:'🇧🇷',prod:3.7,cap:4.5,pct:82,lon:-52,lat:-10,status:'stable',company:'Petrobras',wb_code:'BRA'},
  {country:'EAU',flag:'🇦🇪',prod:3.0,cap:4.5,pct:67,lon:54,lat:24,status:'stable',company:'ADNOC',wb_code:'ARE'},
  {country:'Kuwait',flag:'🇰🇼',prod:2.4,cap:3.0,pct:80,lon:48,lat:29,status:'stable',company:'KOC',wb_code:'KWT'},
  {country:'Kazakhstan',flag:'🇰🇿',prod:2.1,cap:2.5,pct:84,lon:68,lat:48,status:'stable',company:'KazMunaiGas',wb_code:'KAZ'},
  {country:'Noruega',flag:'🇳🇴',prod:1.9,cap:2.2,pct:86,lon:10,lat:62,status:'stable',company:'Equinor',wb_code:'NOR'},
  {country:'México',flag:'🇲🇽',prod:1.8,cap:2.5,pct:72,lon:-102,lat:23,status:'tension',company:'PEMEX',wb_code:'MEX'},
  {country:'Nigeria',flag:'🇳🇬',prod:1.4,cap:2.5,pct:56,lon:8,lat:9,status:'tension',company:'NNPC / Shell',wb_code:'NGA'},
  {country:'Libia',flag:'🇱🇾',prod:1.1,cap:2.0,pct:55,lon:18,lat:27,status:'conflict',company:'NOC',wb_code:'LBY'},
  {country:'Venezuela',flag:'🇻🇪',prod:0.8,cap:3.0,pct:27,lon:-66,lat:8,status:'sanction',company:'PDVSA',wb_code:'VEN'},
];
const STORAGE_DATA=[
  {hub:'Cushing, OK (EE.UU.)',abbr:'CUSH',level:22.3,cap:90,fill:24.8,chg:-0.8,col:'#ff4060'},
  {hub:'US Total (EIA)',abbr:'UST',level:442.7,cap:770,fill:57.5,chg:-2.1,col:'#2979ff'},
  {hub:'ARA Región (Europa)',abbr:'ARA',level:61.2,cap:120,fill:51.0,chg:+0.8,col:'#ffc300'},
  {hub:'Singapore Hub',abbr:'SGP',level:43.8,cap:90,fill:48.7,chg:-1.2,col:'#00e676'},
];
const TANKER_ROUTES=[
  {from:'Golfo Pérsico',to:'China / Asia',type:'VLCC',count:47,status:'normal',transit:'18–22 días'},
  {from:'US Gulf Coast',to:'Europa NW',type:'Suezmax',count:23,status:'normal',transit:'8–12 días'},
  {from:'África Occidental',to:'Asia',type:'VLCC',count:18,status:'normal',transit:'20–25 días'},
  {from:'Mar del Norte',to:'Med / Asia',type:'Aframax',count:31,status:'normal',transit:'5–15 días'},
  {from:'Rusia (Báltico)',to:'India / Asia',type:'Aframax',count:12,status:'restricted',transit:'12–18 días'},
  {from:'Mar Rojo / Golfo Adén',to:'Europa (Cape)',type:'Mixed',count:8,status:'diverted',transit:'+25–35 días'},
];
function renderMapSidebar(){
  document.getElementById('storageCards').innerHTML=STORAGE_DATA.map(s=>`<div class="storage-card"><div class="sc-hub">${s.hub}</div><div class="sc-fill-bar"><div class="sc-fill-inner" style="width:${s.fill}%;background:${s.col}"></div></div><div class="sc-stats"><span>${s.level} Mbl</span><span style="color:${s.col}">${s.fill.toFixed(1)}% lleno</span><span style="color:${s.chg<0?'var(--red)':'var(--green)'}">Δ${s.chg>0?'+':''}${s.chg} Mbl</span></div></div>`).join('');
  document.getElementById('tankerRoutes').innerHTML=TANKER_ROUTES.map(r=>`<div class="tanker-row"><div class="tr-route">🛢 ${r.from} → ${r.to}</div><div class="tr-meta"><span>${r.type}</span><span>${r.count} buques</span><span class="tr-status-${r.status}">${r.status==='normal'?'✓ NORMAL':r.status==='diverted'?'⚠ DESVIADO':'⚡ RESTRINGIDO'}</span><span>⏱ ${r.transit}</span></div></div>`).join('');
}
function renderProdTable(){
  const statusCls={stable:'status-stable',tension:'status-tension',conflict:'status-conflict',sanction:'status-sanction'};
  const statusLbl={stable:'✓ ESTABLE',tension:'⚠ TENSIÓN',conflict:'🔴 CONFLICTO',sanction:'⛔ SANCIÓN'};
  const barCols={stable:'#00e676',tension:'#ffc300',conflict:'#ff4060',sanction:'#b388ff'};
  document.getElementById('prodTableBody').innerHTML=PROD_DATA.map(p=>`<tr><td>${p.flag} ${p.country}</td><td><strong>${p.prod}</strong> Mb/d<div class="prod-bar-bg"><div class="prod-bar-fill" style="width:${(p.prod/p.cap*100).toFixed(0)}%;background:${barCols[p.status]}"></div></div></td><td>${p.cap} Mb/d</td><td><span style="color:${barCols[p.status]}">${p.pct}%</span></td><td style="color:var(--text3)">${p.company}</td><td class="${statusCls[p.status]}">${statusLbl[p.status]}</td></tr>`).join('');
}
function renderMapCanvas(){
  const canvas=document.getElementById('mapCanvas');if(!canvas)return;
  const wrap=document.getElementById('mapView');
  canvas.width=wrap.clientWidth||800;canvas.height=Math.max(wrap.clientHeight||420,420);
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
  const lonToX=lon=>(lon+180)/360*W,latToY=lat=>(90-lat)/180*H;
  ctx.fillStyle='#040610';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(41,121,255,.06)';ctx.lineWidth=.5;
  for(let lon=-180;lon<=180;lon+=30){ctx.beginPath();ctx.moveTo(lonToX(lon),0);ctx.lineTo(lonToX(lon),H);ctx.stroke();}
  for(let lat=-90;lat<=90;lat+=30){ctx.beginPath();ctx.moveTo(0,latToY(lat));ctx.lineTo(W,latToY(lat));ctx.stroke();}
  const routes=[{x1:lonToX(50),y1:latToY(26),x2:lonToX(104),y2:latToY(22),col:'rgba(130,170,255,.25)'},{x1:lonToX(-90),y1:latToY(29),x2:lonToX(5),y2:latToY(52),col:'rgba(0,230,118,.2)'},{x1:lonToX(50),y1:latToY(26),x2:lonToX(78),y2:latToY(20),col:'rgba(255,195,0,.2)'},{x1:lonToX(3),y1:latToY(55),x2:lonToX(26),y2:latToY(60),col:'rgba(255,64,96,.2)'}];
  routes.forEach(r=>{const mx=(r.x1+r.x2)/2,my=Math.min(r.y1,r.y2)-40;ctx.strokeStyle=r.col;ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(r.x1,r.y1);ctx.quadraticCurveTo(mx,my,r.x2,r.y2);ctx.stroke();});ctx.setLineDash([]);
  PROD_DATA.forEach(p=>{
    const px=lonToX(p.lon),py=latToY(p.lat),r=Math.sqrt(p.prod)*4+3;
    const col={stable:'#00e676',tension:'#ffc300',conflict:'#ff4060',sanction:'#b388ff'}[p.status];
    const grd=ctx.createRadialGradient(px,py,0,px,py,r*3);grd.addColorStop(0,col+'40');grd.addColorStop(1,'transparent');
    ctx.fillStyle=grd;ctx.beginPath();ctx.arc(px,py,r*3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=col+'22';ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=col;ctx.font='bold 9px JetBrains Mono';ctx.textAlign='center';ctx.fillText(p.flag+' '+p.prod,px,py-r-3);
  });
  [{lon:56.3,lat:26.5,label:'⚠ HORMUZ',col:'#ff4060'},{lon:32.5,lat:30,label:'◈ SUEZ',col:'#ffc300'},{lon:104,lat:1.3,label:'◈ MALACCA',col:'#00e676'},{lon:43,lat:12,label:'⚠ BAB EL-MANDEB',col:'#ff4060'}].forEach(h=>{
    const hx=lonToX(h.lon),hy=latToY(h.lat);ctx.fillStyle='rgba(6,8,16,.8)';ctx.fillRect(hx-2,hy-12,ctx.measureText(h.label).width+10,14);ctx.fillStyle=h.col;ctx.font='9px JetBrains Mono';ctx.textAlign='left';ctx.fillText(h.label,hx+2,hy-2);
  });
  canvas.onmousemove=e=>{
    const rect=canvas.getBoundingClientRect(),mx=(e.clientX-rect.left)*(W/rect.width),my=(e.clientY-rect.top)*(H/rect.height);
    const tip=document.getElementById('mapTooltip');let hit=null;
    PROD_DATA.forEach(p=>{const px=lonToX(p.lon),py=latToY(p.lat),r=Math.sqrt(p.prod)*4+3;if(Math.hypot(mx-px,my-py)<r+10)hit=p;});
    if(hit){const col={stable:'#00e676',tension:'#ffc300',conflict:'#ff4060',sanction:'#b388ff'}[hit.status];tip.innerHTML=`<div class="mt-country">${hit.flag} ${hit.country}</div><div class="mt-row"><span class="mt-lbl">Producción</span><span class="mt-val">${hit.prod} Mb/d</span></div><div class="mt-row"><span class="mt-lbl">Capacidad</span><span class="mt-val">${hit.cap} Mb/d</span></div><div class="mt-row"><span class="mt-lbl">Utilización</span><span class="mt-val" style="color:${col}">${hit.pct}%</span></div><div class="mt-row"><span class="mt-lbl">Compañía</span><span class="mt-val">${hit.company}</span></div>`;tip.style.left=Math.min(e.offsetX+10,canvas.clientWidth-230)+'px';tip.style.top=Math.max(e.offsetY-20,5)+'px';tip.classList.add('show');}
    else tip.classList.remove('show');
  };
  canvas.onmouseleave=()=>document.getElementById('mapTooltip').classList.remove('show');
}
function setMapView(v){
  S.mapView=v;
  document.getElementById('mapView').style.display=v==='map'?'block':'none';
  document.getElementById('listView').style.display=v==='list'?'block':'none';
  document.getElementById('mt-map').classList.toggle('active',v==='map');
  document.getElementById('mt-list').classList.toggle('active',v==='list');
  if(v==='map')setTimeout(renderMapCanvas,50);
}

/* ── ANALYSIS DATA & RENDER ───────────────── */
const DIGEST=[
  {t:'14:32',imp:'high',text:'IRGC amenaza cierre del Estrecho de Hormuz ante expansión de sanciones — Brent +1.8%',tags:['geo','hormuz']},
  {t:'12:20',imp:'high',text:'GPS spoofing en 3 tanqueros cerca del Estrecho de Hormuz — alerta de seguridad marítima emitida',tags:['geo','tanker']},
  {t:'11:15',imp:'high',text:'Houthi lanza misil contra tanquero en Bab el-Mandeb — riesgo elevado a CRÍTICO',tags:['geo','red-sea']},
  {t:'10:48',imp:'med',text:'Arabia Saudita extiende recorte voluntario de 1 Mb/d hasta Q4 2025 — OPEC+ confirma',tags:['opec']},
  {t:'09:15',imp:'high',text:'EIA: inventarios crudos -2.147M bbl (consenso -1.4M) — Cushing en mínimo de 8 meses',tags:['inv','eia']},
  {t:'08:30',imp:'med',text:'Producción shale EE.UU. sube a 13.3 Mb/d en mayo — Baker Hughes: rigs +3 a 480',tags:['prod','usa']},
  {t:'07:00',imp:'low',text:'China: restricciones de envío a crudos venezolanos — ban de buques de terceros extendido',tags:['geo','china']},
  {t:'06:45',imp:'med',text:'Noruega: producción alcanza 1.92 Mb/d en mayo, por encima de pronóstico (Johan Sverdrup)',tags:['prod','norway']},
  {t:'05:30',imp:'low',text:'EIA STEO: producción crudo EE.UU. revisada al alza a 13.6 Mb/d para 2025',tags:['eia','usa']},
  {t:'04:15',imp:'med',text:'Tanquero ruso desvía ruta por zona de embargo en el Báltico — descuento de precios se amplía',tags:['russia','sanction']},
];
const PROJECTIONS=[
  {src:'Goldman Sachs',analyst:'Daan Struyven',q3:78,q4:82,h126:80,bias:'bullish',date:'10-Jun-25'},
  {src:'JPMorgan',analyst:'Natasha Kaneva',q3:76,q4:80,h126:78,bias:'bullish',date:'08-Jun-25'},
  {src:'Citigroup',analyst:'Ed Morse',q3:72,q4:75,h126:73,bias:'neutral',date:'05-Jun-25'},
  {src:'Morgan Stanley',analyst:'Martijn Rats',q3:68,q4:72,h126:70,bias:'bearish',date:'09-Jun-25'},
  {src:'IEA',analyst:'Official Forecast',q3:75,q4:77,h126:76,bias:'neutral',date:'11-Jun-25'},
  {src:'EIA STEO',analyst:'US Gov. Official',q3:74,q4:78,h126:75,bias:'neutral',date:'10-Jun-25'},
  {src:'OPEC MOMR',analyst:'OPEC Sec. Gen.',q3:80,q4:85,h126:82,bias:'bullish',date:'07-Jun-25'},
  {src:'Bank of America',analyst:'Francisco Blanch',q3:77,q4:81,h126:79,bias:'bullish',date:'06-Jun-25'},
  {src:'Barclays',analyst:'Amarpreet Singh',q3:71,q4:74,h126:73,bias:'neutral',date:'04-Jun-25'},
  {src:'Fitch Solutions',analyst:'Energy Research',q3:69,q4:72,h126:70,bias:'bearish',date:'03-Jun-25'},
];
function renderAnalysis(){
  document.getElementById('digestList').innerHTML=DIGEST.map(d=>`<div class="digest-item"><div class="di-time">${d.t}</div><div class="di-body"><span class="di-impact impact-${d.imp}">${d.imp.toUpperCase()}</span><div class="di-text">${d.text}</div><div class="di-tags">${d.tags.map(t=>`<span class="di-tag">${t}</span>`).join('')}</div></div></div>`).join('');
  const bm={bullish:'bias-bull',bearish:'bias-bear',neutral:'bias-neu'},bi={bullish:'▲ ALCISTA',bearish:'▼ BAJISTA',neutral:'— NEUTRAL'};
  document.getElementById('projTableBody').innerHTML=PROJECTIONS.map(p=>`<tr><td><strong>${p.src}</strong></td><td style="color:var(--text3)">${p.analyst}</td><td style="color:var(--yellow)">$${p.q3}</td><td style="color:var(--yellow)">$${p.q4}</td><td style="color:var(--blue2)">$${p.h126}</td><td class="${bm[p.bias]}">${bi[p.bias]}</td><td style="color:var(--text3)">${p.date}</td></tr>`).join('');
  document.getElementById('sentimentRow').innerHTML=[{label:'SENTIMIENTO GLOBAL',value:62,desc:'LEV. ALCISTA',col:'#00e676'},{label:'TENSIÓN GEOPOLÍTICA',value:78,desc:'ALTA',col:'#ff4060'},{label:'SESGO OFERTA/DEMANDA',value:54,desc:'EQUILIBRADO',col:'#ffc300'}].map(s=>`<div class="sent-card"><div class="sent-label">${s.label}</div><svg class="sent-gauge" viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" fill="none" stroke="#1f2235" stroke-width="6"/><circle cx="30" cy="30" r="24" fill="none" stroke="${s.col}" stroke-width="6" stroke-dasharray="${(s.value/100)*150.8} 150.8" stroke-dashoffset="37.7" stroke-linecap="round" transform="rotate(-90 30 30)"/></svg><div class="sent-value" style="color:${s.col}">${s.value}</div><div class="sent-desc">${s.desc}</div></div>`).join('');
}

/* ── BACKGROUND MAP ───────────────────────── */
const BG_CENTERS=[{lon:45,lat:24,p:9},{lon:53,lat:32,p:3.5},{lon:48,lat:29,p:2.4},{lon:54,lat:24,p:3},{lon:44,lat:33,p:4.3},{lon:-97,lat:38,p:13.3},{lon:-110,lat:56,p:5.8},{lon:60,lat:58,p:9.2},{lon:68,lat:48,p:2.1},{lon:-52,lat:-10,p:3.7},{lon:-66,lat:8,p:.8},{lon:18,lat:27,p:1.1},{lon:8,lat:9,p:1.4},{lon:10,lat:62,p:1.9},{lon:-102,lat:23,p:1.8}];
function renderBgMap(){
  const canvas=document.getElementById('bgCanvas');
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,t=Date.now()/1000;
  ctx.clearRect(0,0,W,H);
  const lX=lon=>(lon+180)/360*W,lY=lat=>(90-lat)/180*H;
  ctx.strokeStyle='rgba(41,121,255,.025)';ctx.lineWidth=.5;
  for(let lon=-180;lon<=180;lon+=30){ctx.beginPath();ctx.moveTo(lX(lon),0);ctx.lineTo(lX(lon),H);ctx.stroke();}
  for(let lat=-90;lat<=90;lat+=30){ctx.beginPath();ctx.moveTo(0,lY(lat));ctx.lineTo(W,lY(lat));ctx.stroke();}
  BG_CENTERS.forEach((c,idx)=>{
    const px=lX(c.lon),py=lY(c.lat),pulse=.5+.5*Math.sin(t*1.4+idx*.8),r=Math.sqrt(c.p)*2.5;
    const grd=ctx.createRadialGradient(px,py,0,px,py,r*(2+pulse));grd.addColorStop(0,`rgba(255,109,0,${.15*pulse})`);grd.addColorStop(1,'transparent');
    ctx.fillStyle=grd;ctx.beginPath();ctx.arc(px,py,r*(2+pulse),0,Math.PI*2);ctx.fill();
    ctx.fillStyle=`rgba(255,109,0,${.5+.5*pulse})`;ctx.beginPath();ctx.arc(px,py,Math.max(1.5,r*.3),0,Math.PI*2);ctx.fill();
  });
  requestAnimationFrame(renderBgMap);
}

/* ── TICKER & CLOCKS ──────────────────────── */
const TICKERS=[{sym:'BRENT ICE',key:'brent'},{sym:'WTI NYMEX',key:'wti'},{sym:'COIL FUT',key:'coil'},{sym:'NAT GAS',key:'ng'},{sym:'HEATING OIL',key:'heatoil'},{sym:'RBOB GAS',key:'rbob'}];
function buildTicker(){
  let html='';for(let rep=0;rep<2;rep++){TICKERS.forEach(t=>{const p=S.prices[t.key],c=S.changes[t.key]||0,dir=c>0?'up':c<0?'dn':'flat';html+=`<span class="ticker-item" id="tk-${t.key}-${rep}"><span class="ti-name">${t.sym}</span><span class="ti-price price-${dir}">$${p}</span><span class="ti-price price-${dir}" style="font-size:10px"> ${c>0?'▲':c<0?'▼':'—'}${Math.abs(c).toFixed(2)}%</span></span><span style="color:#1f2235;padding:0 4px">|</span>`;});}
  document.getElementById('tickerTrack').innerHTML=html;
}
function updateTicker(){
  TICKERS.forEach(t=>{
    if(!S.liveActive){const drift=(Math.random()-.499)*.04;S.prices[t.key]=+(S.prices[t.key]+drift).toFixed(t.key==='ng'||t.key==='rbob'||t.key==='heatoil'?3:2);}
    const base={brent:74.38,wti:70.81,coil:71.42,ng:2.847,heatoil:2.118,rbob:2.264}[t.key];
    const pct=+((S.prices[t.key]-base)/base*100).toFixed(2);S.changes[t.key]=pct;
    const dir=pct>0?'up':pct<0?'dn':'flat';
    for(let rep=0;rep<2;rep++){const el=document.getElementById(`tk-${t.key}-${rep}`);if(!el)return;const sp=el.querySelectorAll('.ti-price');sp[0].className=`ti-price price-${dir}`;sp[0].textContent=`$${S.prices[t.key]}`;sp[1].className=`ti-price price-${dir}`;sp[1].style.fontSize='10px';sp[1].textContent=` ${pct>0?'▲':pct<0?'▼':'—'}${Math.abs(pct).toFixed(2)}%`;}
  });
  const a=S.asset,p=S.prices[a]||S.prices.brent,c=S.changes[a]||0;
  const el=document.getElementById('priceTag');if(el)el.innerHTML=`<span style="color:${c>0?'var(--green)':c<0?'var(--red)':'var(--text)'}">$${p} <span style="font-size:11px">${c>0?'▲':'▼'} ${c>0?'+':''}${c.toFixed(2)}%</span></span>`;
}
function updateClocks(){
  [['clk-ny','st-ny','America/New_York'],['clk-ldn','st-ldn','Europe/London'],['clk-dxb','st-dxb','Asia/Dubai'],['clk-sgp','st-sgp','Asia/Singapore'],['clk-bue','st-bue','America/Argentina/Buenos_Aires']].forEach(([ci,si,zone])=>{
    const t=new Date().toLocaleString('en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    const clk=document.getElementById(ci),st=document.getElementById(si);if(clk)clk.textContent=t;
    if(st){const h=parseInt(new Date().toLocaleString('en-US',{timeZone:zone,hour:'2-digit',hour12:false}));const op=h>=9&&h<17;st.textContent=op?'● ABIERTO':'● CERRADO';st.className=op?'tc-status tc-open':'tc-status tc-closed';}
  });
}

/* ── UI CONTROLS ──────────────────────────── */
function switchTab(tab){
  S.tab=tab;
  document.querySelectorAll('.tab-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.getElementById('tbn-'+tab).classList.add('active');
  if(tab==='charts'){S.chartData=null;setTimeout(()=>{renderChart();initChartMouse();},50);loadRealCandles();fetchAlphaVantage();}
  if(tab==='map'){setTimeout(()=>{renderMapCanvas();renderProdTable();renderMapSidebar();setMapView(S.mapView);},50);}
  if(tab==='news'){renderNews();renderNewsSidebar();}
  if(tab==='analysis'){renderAnalysis();if(NEWS.length>3)fetchAISummary();}
}
function selAsset(a,btn){
  S.asset=a;S.hover=-1;S.chartData=null;
  document.querySelectorAll('#assetSel .seg-btn').forEach(b=>b.className='seg-btn');btn.className='seg-btn active';
  renderChart();loadRealCandles();fetchAlphaVantage();
}
function selTF(tf,btn){
  S.tf=tf;S.hover=-1;S.chartData=null;
  document.querySelectorAll('#tfSel .seg-btn').forEach(b=>b.className='seg-btn');btn.className='seg-btn active';
  renderChart();loadRealCandles();fetchAlphaVantage();
}
function toggleInd(ind,btn,onCls){
  S.ind[ind]=!S.ind[ind];
  if(S.ind[ind])btn.classList.add(onCls);else btn.className='ind-btn';
  S.hover=-1;renderChart();
}

/* ── NEWS SIMULATION ──────────────────────── */
function startSim(){
  setInterval(()=>{
    if(Math.random()>.75){
      const t=['OPEC+ cumplimiento actualizado — producción grupal en {x} Mb/d','Brent técnico: RSI {x} — territorio {dir}','API crude stocks: {x}M bbl','Baker Hughes rigs: {x}','Flete VLCC AG-China: {x} $/mt'];
      const txt=t[Math.floor(Math.random()*t.length)].replace('{x}',+(Math.random()*10).toFixed(1)).replace('{dir}',Math.random()>.5?'sobrecomprado':'sobrevendido').replace('{x}',Math.floor(Math.random()*5-2));
      NEWS.unshift({id:Date.now(),ts:new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false}),src:'platts',srcL:'S&P PLATTS',srcColor:'#b388ff',impact:['low','med','high'][Math.floor(Math.random()*3)],cat:['prod','inv','opec','geo'][Math.floor(Math.random()*4)],hl:txt,hi:false,chg:''});
      if(NEWS.length>60)NEWS.pop();if(S.tab==='news')renderNews();
    }
  },12000);
}

/* ── INIT ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  buildTicker();updateClocks();
  setInterval(updateClocks,1000);
  setInterval(updateTicker,3000);
  // Actualizar precios reales cada 60 segundos si hay key
  setInterval(fetchTwelveDataPrices,60000);
  // Actualizar noticias cada 10 minutos si hay key
  setInterval(fetchGNews,600000);
  setInterval(fetchNewsAPI,600000);
  startSim();
  renderBgMap();
  // Llamadas iniciales a APIs
  fetchTwelveDataPrices();
  fetchEIAInventories();
  fetchGNews();
  fetchNewsAPI();
  fetchWorldBank();
  fetchAlphaVantage();
  setTimeout(fetchAISummary, 15000);
  setInterval(fetchEIAInventories, 3600000);
  setInterval(fetchAlphaVantage, 3600000);
  // Tab inicial
  switchTab('charts');
  window.addEventListener('resize',()=>{
    if(S.tab==='charts')renderChart();
    if(S.tab==='map')renderMapCanvas();
  });
});
</script>
</body>
</html>
