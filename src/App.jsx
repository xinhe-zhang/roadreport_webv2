import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { supabase } from './lib/supabase';
import { MapPin, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import wellknown from 'wellknown';

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const hoverPopup = useRef(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);

  // 1. 初始化地圖(basemap)
  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [121.53, 25.04],
      zoom: 11,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    hoverPopup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 15
    });


    map.current.on('load', () => { //run when map is loaded

      // initilaize clustering data source
      map.current.addSource('reports-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true, // open clustering
        clusterMaxZoom: 14, // when zoom in to this scale, stop clustering and use single point
        clusterRadius: 50  //px
      });

      // Cluster bubble layer
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'reports-src',
        filter: ['has', 'point_count'], // 只顯示聚合點
        paint: {
          // 根據數量變色：小於10(紅)、10-30(淡紅)、大於30(粉紅)
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#ff6d63ff', 10, 
            '#f99c9cff', 30, 
            '#EF4444'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20, 10, 30, 30, 40
          ],
          'circle-stroke-width': 0,
        }
      });

      // 【聚合數字圖層】
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'reports-src',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count}',
          'text-font': ['Noto Sans Regular'],
          'text-size': 14
        },
        paint: { 'text-color': '#ffffff' }
      });

      // 【單一事件點圖層】
      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'reports-src',
        filter: ['!', ['has', 'point_count']], // 排除已聚合的點
        paint: {
          'circle-color': '#EF4444',
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });

      // 點擊聚合泡泡：自動放大地圖
      map.current.on('click', 'clusters', async (e) => {
        const features = map.current.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0].properties.cluster_id;
        const zoom = await map.current.getSource('reports-src').getClusterExpansionZoom(clusterId);
        map.current.easeTo({ center: features[0].geometry.coordinates, zoom });
      });

      // Hover 事件
      map.current.on('mouseenter', 'unclustered-point', (e) => {
        map.current.getCanvas().style.cursor = 'pointer';
        setHoveredId(e.features[0].properties.id);
      });

      map.current.on('mouseleave', 'unclustered-point', () => {
        map.current.getCanvas().style.cursor = '';
        setHoveredId(null);
      });

      fetchReports();
    });

    return () => map.current?.remove();
  }, []);

  // 2. 當 reports 改變時更新地圖
  useEffect(() => {
    const source = map.current?.getSource('reports-src');
    if (!source || !reports.length) return;

    const geojson = {
      type: 'FeatureCollection',
      features: reports.map(report => {
        try {
          const geometry = wellknown.parse(report.geom_wkt);
          return {
            type: 'Feature',
            geometry,
            properties: { ...report }
          };
        } catch (e) {
          return null;
        }
      }).filter(f => f !== null)
    };
    source.setData(geojson);
  }, [reports]);

  // 3. 處理 Hover 連動與 Popup (保持不變)
  useEffect(() => {
    if (!map.current || !hoverPopup.current) return;
    if (!hoveredId) {
      hoverPopup.current.remove();
      return;
    }
    const target = reports.find(r => r.id === hoveredId);
    if (target) {
      const geom = wellknown.parse(target.geom_wkt);
      hoverPopup.current
        .setLngLat(geom.coordinates)
        .setHTML(`
          <div class="p-2 font-sans min-w-[140px]">
            <div class="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mb-1 ${
              target.severity === '緊急' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
            }">${target.type}</div>
            <div class="text-sm font-medium text-slate-800">${target.description || '無描述'}</div>
          </div>`)
        .addTo(map.current);
    }
  }, [hoveredId, reports]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('road_reports_view')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('抓取失敗:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden">
    {/* header */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-20">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-500 p-1.5 rounded-lg"><AlertTriangle size={20} className="text-slate-900" /></div>
          <h1 className="text-xl font-bold tracking-tight">RoadReport 2.0</h1>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-lg">
          <Plus size={18} /><span>通報案件</span>
        </button>
      </header>

      {/* navbar */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-inner z-10">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <MapPin size={16} className="text-blue-500" />案件列表 ({reports.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Loader2 className="animate-spin mb-2" />
                <p className="text-sm">資料讀取中...</p>
                </div>
            ) : (
                reports.map((report) => {
                // 1. 定義顏色映射表
                const statusColors = {
                    '待處理': 'bg-red-500',    // 紅色
                    '處理中': 'bg-orange-500', // 橘色
                    '已完成': 'bg-green-500',  // 綠色
                };

                // 2. 根據 report.status 取得對應顏色，若無對應則預設灰色
                const dotColor = statusColors[report.status] || 'bg-slate-400';

                // 3. 回傳 JSX
                return (
                    <div 
                    key={report.id}
                    onMouseEnter={() => setHoveredId(report.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => {
                        try {
                        const geom = wellknown.parse(report.geom_wkt);
                        map.current.flyTo({ 
                            center: geom.coordinates, 
                            zoom: 15,
                            speed: 1.2 
                        });
                        } catch (err) {
                        console.error("解析座標失敗:", err);
                        }
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer bg-white group ${
                        hoveredId === report.id 
                        ? 'border-blue-500 shadow-md ring-1 ring-blue-500 bg-blue-50/10' 
                        : 'border-slate-100 hover:border-blue-300'
                    }`}
                    >
                    {/* 第一列：類型標籤與日期 */}
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        report.severity === '緊急' 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-orange-100 text-orange-600'
                        }`}>
                        {report.type}
                        </span>
                        <span className="text-[10px] text-slate-400">
                        {new Date(report.created_at).toLocaleDateString()}
                        </span>
                    </div>

                    {/* 第二列：案件描述 (最多顯示兩行) */}
                    <p className="text-slate-700 text-sm font-medium mb-2 line-clamp-2">
                        {report.description || '無描述內容'}
                    </p>

                    {/* 第三列：處理狀態與動態小圓點 */}
                    <div className="flex items-center text-[11px] text-slate-500">
                        <div className={`w-2 h-2 rounded-full ${dotColor} mr-2 animate-pulse`}></div>
                        {report.status || '未定義狀態'}
                    </div>
                    </div>
                );
                })
            )}
            </div>
        </aside>

        <main className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
          <div className="absolute bottom-6 left-6 z-10 bg-white/90 backdrop-blur p-3 rounded-lg shadow-xl border border-white/50 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              滾動以縮放
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;