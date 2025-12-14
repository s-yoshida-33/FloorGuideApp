import React, { useState, useEffect } from "react";
import { fetchShopsFromBridge } from "../api/bridgeClient";
import type { Shop } from "../types/shop";
import type { ShopSettings } from "../types/shopSettings";

interface ShopSettingsTabProps {
  shopSettings: ShopSettings;
  onChangeShopSettings: (settings: ShopSettings) => void;
}

export const ShopSettingsTab: React.FC<ShopSettingsTabProps> = ({
  shopSettings,
  onChangeShopSettings,
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

      {/* Floor Selector */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            color: "rgba(255, 255, 255, 0.8)",
            fontSize: 13,
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          フロア選択
        </label>
        <select
          value={selectedFloor}
          onChange={(e) => {
            setSelectedFloor(e.target.value);
            setSelectedShopId(null);
          }}
          style={{
            width: "100%",
            padding: "8px 12px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 14,
          }}
        >
          {["1F", "2F", "3F", "4F"].map((f) => (
            <option
              key={f}
              value={f}
              style={{
                backgroundColor: "#2C2C2C",
                color: "#ffffff",
              }}
            >
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Shop Selector (Dropdown) */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            color: "rgba(255, 255, 255, 0.8)",
            fontSize: 13,
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          ショップ選択
        </label>
        <select
          value={selectedShopId || ""}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedShopId(val || null);
          }}
          style={{
            width: "100%",
            padding: "8px 12px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 14,
          }}
        >
          <option value="" style={{ backgroundColor: "#2C2C2C", color: "#999" }}>
            （選択してください）
          </option>
          {floorShops.map((s) => (
            <option
              key={s.shopId || s.name}
              value={s.shopId || ""}
              style={{
                backgroundColor: "#2C2C2C",
                color: "#ffffff",
              }}
            >
              {s.number ? `${s.number} - ` : ""}{s.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 0 }}>
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
                </div>
            ) : (
                <div style={{ 
                    flex: 1, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    opacity: 0.5, 
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderRadius: 6,
                    height: "200px" // give it some height
                }}>
                    上のプルダウンからショップを選択してください
                </div>
            )}
          </div>
      </div>
    </div>
  );
};


