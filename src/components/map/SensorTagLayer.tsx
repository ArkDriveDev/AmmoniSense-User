import React, { useEffect } from 'react';
import L from 'leaflet';
import { ReadingMarkerData, getAmmoniaColor } from './FullMapView';

export interface SensorTagLayerProps {
  map: L.Map | null;
  readings?: ReadingMarkerData[];
  showReadings?: boolean;
  onSelectReading?: (reading: ReadingMarkerData) => void;
}

export const SensorTagLayer: React.FC<SensorTagLayerProps> = ({
  map,
  readings = [],
  showReadings = true,
  onSelectReading,
}) => {
  useEffect(() => {
    if (!map) return;

    const readingsGroup = L.layerGroup().addTo(map);

    if (showReadings) {
      readings.forEach((reading) => {
        const color = getAmmoniaColor(reading.ammonia);
        const isPending = reading.is_pending_sync;

        const readingIcon = L.divIcon({
          className: 'custom-reading-tag-marker',
          html: `
            <div style="
              position: relative;
              background: ${color};
              color: #ffffff;
              font-weight: 800;
              font-size: 11px;
              padding: 3px 8px;
              border-radius: 14px;
              border: 2px solid #ffffff;
              box-shadow: 0 3px 12px rgba(0,0,0,0.35);
              white-space: nowrap;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 3px;
            ">
              <span>📍 ${reading.ammonia.toFixed(1)}</span>
              <span style="font-size: 8px; opacity: 0.9;">PPM</span>
              ${isPending ? `
                <span style="
                  position: absolute;
                  top: -4px;
                  right: -4px;
                  width: 10px;
                  height: 10px;
                  background-color: #f59e0b;
                  border: 2px solid white;
                  border-radius: 50%;
                "></span>
              ` : ''}
            </div>
          `,
          iconSize: [64, 26],
          iconAnchor: [32, 13],
        });

        const marker = L.marker([reading.latitude, reading.longitude], {
          icon: readingIcon,
          zIndexOffset: 1000,
        });

        marker.on('click', () => {
          if (onSelectReading) onSelectReading(reading);
        });

        readingsGroup.addLayer(marker);
      });
    }

    return () => {
      map.removeLayer(readingsGroup);
    };
  }, [map, readings, showReadings, onSelectReading]);

  return null;
};

export default SensorTagLayer;
