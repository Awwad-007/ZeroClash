import React from 'react';
import { Html } from '@react-three/drei';
import { useCampusStore } from '../store/campusStore';

interface EquipmentPinsProps {
  onSelectUnit?: (unitId: string) => void;
}

export const EquipmentPins: React.FC<EquipmentPinsProps> = ({ onSelectUnit }) => {
  const buildings = useCampusStore((s) => s.buildings);
  const equipment = useCampusStore((s) => s.equipment);
  const selectedUnitId = useCampusStore((s) => s.selectedUnitId);
  const matchingUnitIds = useCampusStore((s) => s.matchingUnitIds);
  const matchingBuildingIds = useCampusStore((s) => s.matchingBuildingIds);
  const selectUnit = useCampusStore((s) => s.selectUnit);

  return (
    <group>
      {buildings.map((building) => {
        if (!building.equipmentIds || building.equipmentIds.length === 0) return null;

        const count = building.equipmentIds.length;
        const roofY = building.size[1] + 1.2;

        return (
          <group key={building.id} position={building.position}>
            {building.equipmentIds.map((unitId, index) => {
              const unit = equipment[unitId];
              if (!unit) return null;

              const isSelected = selectedUnitId === unitId;
              const isMatch = matchingUnitIds.includes(unitId);

              // Calculate pin offset positions above building roof
              let offsetX = 0;
              let offsetZ = 0;
              let offsetY = roofY;

              if (count === 2) {
                // Two pins side by side
                offsetX = (index - 0.5) * 2.0;
                offsetZ = (index - 0.5) * -0.4;
              } else if (count === 3) {
                // Triangle layout for 3 pins:
                // Camera (left), GPU (right), VR Headset (front-center)
                if (index === 0) {
                  offsetX = -1.3;
                  offsetZ = -0.7;
                } else if (index === 1) {
                  offsetX = 1.3;
                  offsetZ = -0.7;
                } else {
                  offsetX = 0.0;
                  offsetZ = 0.9;
                  offsetY = roofY - 0.15;
                }
              }

              // Color theme mapping
              let pinBorderColor = '#00f0ff';
              let pinBgColor = 'rgba(6, 25, 45, 0.9)';
              let pinGlowColor = 'rgba(0, 240, 255, 0.5)';

              if (building.colorTheme === 'green') {
                pinBorderColor = '#22c55e';
                pinBgColor = 'rgba(6, 38, 20, 0.9)';
                pinGlowColor = 'rgba(34, 197, 94, 0.5)';
              } else if (building.colorTheme === 'orange') {
                pinBorderColor = '#f97316';
                pinBgColor = 'rgba(40, 18, 6, 0.9)';
                pinGlowColor = 'rgba(249, 115, 22, 0.5)';
              }

              const bobClass =
                index === 0 ? 'pin-bob' : index === 1 ? 'pin-bob-offset-1' : 'pin-bob-offset-2';

              return (
                <Html
                  key={unit.id}
                  position={[offsetX, offsetY, offsetZ]}
                  center
                >
                  <div
                    className={`${bobClass} transition-all duration-300 ${
                      isMatch ? 'opacity-100' : 'opacity-15'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectUnit(unit.id);
                        onSelectUnit?.(unit.id);
                      }}
                      className={`relative group flex flex-col items-center cursor-pointer transition-transform duration-200 hover:scale-125 focus:outline-none ${
                        isSelected ? 'scale-110' : ''
                      }`}
                      title={`${unit.name} (${unit.statusText})`}
                    >
                      {/* Teardrop Badge Container */}
                      <div
                        className="relative p-1 rounded-full shadow-lg transition-all duration-200"
                        style={{
                          background: pinBgColor,
                          border: `2px solid ${isSelected ? '#ffffff' : pinBorderColor}`,
                          boxShadow: isSelected
                            ? `0 0 18px #ffffff, 0 0 25px ${pinBorderColor}`
                            : `0 0 14px ${pinGlowColor}`,
                        }}
                      >
                        {/* Cropped Circular Equipment Icon */}
                        <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-black/40">
                          <img
                            src={unit.iconUrl}
                            alt={unit.name}
                            className="w-full h-full object-cover rounded-full select-none pointer-events-none drop-shadow"
                            onError={(e) => {
                              // Graceful fallback if image is missing
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>

                        {/* Status Dot Badge on top corner */}
                        <div
                          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-slate-900 ${
                            unit.status === 'available'
                              ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                              : unit.status === 'booked'
                              ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                              : 'bg-amber-400 shadow-[0_0_6px_#facc15]'
                          }`}
                        />
                      </div>

                      {/* Teardrop Pointed Stem */}
                      <div
                        className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] -mt-[1px]"
                        style={{
                          borderTopColor: isSelected ? '#ffffff' : pinBorderColor,
                          filter: `drop-shadow(0 2px 4px ${pinGlowColor})`,
                        }}
                      />
                    </button>
                  </div>
                </Html>
              );
            })}

            {/* Building Name Label */}
            <Html
              key={`label-${building.id}`}
              position={
                building.id === 'bldg-science'
                  ? [-0.6, 3.5, 0.2]
                  : building.id === 'bldg-library'
                  ? [-1.5, 0.2, -4.0]
                  : building.id === 'bldg-media-1'
                  ? [0, 0.2, 2.8]
                  : [0, 0.2, 3.2]
              }
              center
            >
              <div
                className={`pointer-events-none select-none px-2 py-0.5 rounded text-[11px] font-mono tracking-wide font-medium whitespace-nowrap transition-all duration-300 ${
                  matchingBuildingIds.includes(building.id) ? 'opacity-90' : 'opacity-20'
                }`}
                style={{
                  background: 'rgba(5, 11, 20, 0.85)',
                  border: `1px solid ${
                    building.colorTheme === 'green'
                      ? '#22c55e'
                      : building.colorTheme === 'orange'
                      ? '#f97316'
                      : '#0284c7'
                  }66`,
                  color: '#f8fafc',
                  boxShadow: `0 0 10px ${
                    building.colorTheme === 'green'
                      ? '#22c55e'
                      : building.colorTheme === 'orange'
                      ? '#f97316'
                      : '#0284c7'
                  }33`,
                  textShadow: `0 0 8px ${
                    building.colorTheme === 'green'
                      ? '#22c55e'
                      : building.colorTheme === 'orange'
                      ? '#f97316'
                      : '#0284c7'
                  }`,
                }}
              >
                {building.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
