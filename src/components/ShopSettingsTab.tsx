import React, { useState, useEffect } from "react";
import { fetchShopsFromBridge } from "../api/bridgeClient";
import type { Shop } from "../types/shop";
import type { ShopSettings } from "../types/shopSettings";
import ShopList from "./ShopList";
import type { GenreMappings } from "../types/genreSettings";

interface ShopSettingsTabProps {
  shopSettings: ShopSettings;
  onChangeShopSettings: (settings: ShopSettings) => void;
  genreMappings: GenreMappings; // Need for preview
}

export const ShopSettingsTab: React.FC<ShopSettingsTabProps> = ({
  shopSettings,
  onChangeShopSettings,
  genreMappings,
}) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>("1F");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  useEffect(() => {
    fetchShopsFromBridge().then(setShops).catch(console.error);
  }, []);

  // Filter shops by floor
  const floorShops = shops.filter(s => {
      // Very basic floor check. BridgeClient normalizes floors, so check string inclusion
      return s.floors.includes(selectedFloor);
  });
  
  // Sort by number
  floorShops.sort((a, b) => (a.number || "").localeCompare(b.number || "", "ja", { numeric: true }));

  const selectedShop = shops.find(s => s.shopId === selectedShopId);

  const handleSettingChange = (val: string) => {
    if (!selectedShopId) return;
    const num = val === "" ? undefined : parseInt(val, 10);
    
    onChangeShopSettings({
        ...shopSettings,
        [selectedShopId]: {
            ...shopSettings[selectedShopId],
            genreMemoMaxItems: num
        }
    });
  };

  const currentSetting = selectedShopId && shopSettings[selectedShopId] 
      ? shopSettings[selectedShopId]?.genreMemoMaxItems 
      : undefined;

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>ショップ別設定</h3>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
          個別のショップごとにジャンルメモの表示件数を設定します。<br/>
          区切り文字（、 , ・ / | ｜ スペース）で区切られた項目のうち、先頭から指定した件数だけを表示します。<br/>
          ここでの設定はジャンルごとの設定よりも優先されます。
        </p>
      </div>

      {/* Floor Selector */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <label>フロア:</label>
        <select 
            value={selectedFloor} 
            onChange={e => {
                setSelectedFloor(e.target.value);
                setSelectedShopId(null);
            }} 
            style={{ 
                padding: "4px 8px", 
                borderRadius: 4, 
                border: "1px solid rgba(255,255,255,0.2)",
                backgroundColor: "rgba(255,255,255,0.1)",
                color: "#fff"
            }}
        >
            {["1F", "2F", "3F", "4F"].map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 0 }}>
          {/* Shop List */}
          <div style={{ 
              flex: 1, 
              border: "1px solid rgba(255,255,255,0.1)", 
              borderRadius: 6,
              backgroundColor: "rgba(0,0,0,0.2)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column"
          }}>
            {floorShops.map(s => (
                <div 
                    key={s.shopId || s.name} 
                    onClick={() => setSelectedShopId(s.shopId || null)}
                    style={{ 
                        padding: "8px 12px", 
                        cursor: "pointer",
                        backgroundColor: selectedShopId === s.shopId ? "rgba(0, 122, 255, 0.5)" : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        fontSize: 14
                    }}
                >
                    <span style={{ display: "inline-block", width: "3em", opacity: 0.7 }}>{s.number}</span>
                    <span>{s.name}</span>
                </div>
            ))}
            {floorShops.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", opacity: 0.5 }}>ショップがありません</div>
            )}
          </div>

          {/* Settings & Preview */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {selectedShop ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ padding: 16, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
                        <h4 style={{ margin: "0 0 12px 0", fontSize: 16 }}>{selectedShop.name}</h4>
                        <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
                            ジャンルメモ最大表示件数 (空欄: すべて表示)
                        </label>
                        <input 
                            type="number" 
                            min="0"
                            value={currentSetting ?? ""} 
                            onChange={e => handleSettingChange(e.target.value)}
                            placeholder="すべて表示"
                            style={{ 
                                width: "100%", 
                                padding: "8px", 
                                borderRadius: 4, 
                                border: "1px solid rgba(255,255,255,0.2)",
                                backgroundColor: "rgba(255,255,255,0.1)",
                                color: "#fff"
                            }}
                        />
                    </div>
                    
                    <div>
                        <h5 style={{ margin: "0 0 8px 0", fontSize: 14, opacity: 0.7 }}>プレビュー</h5>
                        <div style={{ 
                            border: "1px solid #ddd", 
                            height: 120, // fixed height for preview
                            backgroundColor: "#fff", 
                            color: "#000",
                            overflow: "hidden",
                            position: "relative"
                        }}>
                             {/* Mock ShopList Environment */}
                             <div style={{ 
                                 transform: "scale(0.8)", 
                                 transformOrigin: "top left", 
                                 width: "125%", 
                                 height: "125%" 
                             }}>
                                <ShopList 
                                    shops={[selectedShop]} 
                                    floor={selectedFloor} 
                                    columnCount={1}
                                    rowsPerColumn={5}
                                    genreMappings={genreMappings}
                                    shopSettings={shopSettings}
                                />
                             </div>
                        </div>
                        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                            ※実際の表示はレイアウト設定により異なります
                        </p>
                    </div>
                </div>
            ) : (
                <div style={{ 
                    flex: 1, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    opacity: 0.5, 
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderRadius: 6
                }}>
                    左のリストからショップを選択してください
                </div>
            )}
          </div>
      </div>
    </div>
  );
};


