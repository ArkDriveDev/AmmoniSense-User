import React, { useState, useMemo } from 'react';
import { IonSearchbar } from '@ionic/react';
import { InspectionTag } from '../../types/inspection';
import { getTagAveragePpm } from '../../services/tagService';
import TagCard from './TagCard';

interface Props {
  tags: InspectionTag[];
  onSelectTag?: (tag: InspectionTag) => void;
  onEditTag?: (tag: InspectionTag) => void;
  onDeleteTag?: (tag: InspectionTag) => void;
}

export const TagList: React.FC<Props> = ({ tags, onSelectTag, onEditTag, onDeleteTag }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.toUpperCase();
    return tags.filter((t) => t.tag_name.includes(q) || t.status.includes(q));
  }, [tags, search]);

  const stats = useMemo(() => {
    const avgs = tags.map((t) => getTagAveragePpm(t)).filter((v): v is number => v !== null && !isNaN(v));
    if (avgs.length === 0) return { max: null as number | null, avg: null as number | null };
    const max = Math.max(...avgs);
    const avg = avgs.reduce((acc, v) => acc + v, 0) / avgs.length;
    return { max, avg };
  }, [tags]);

  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px', padding: '10px 14px', background: '#F8FAFC', borderRadius: '10px', fontSize: '13px' }}>
          <span><strong>Total:</strong> {tags.length}</span>
          <span>•</span>
          <span><strong>Avg NH₃:</strong> {stats.avg !== null ? `${stats.avg.toFixed(2)} ppm` : '—'}</span>
          <span>•</span>
          <span><strong>Max Avg:</strong> {stats.max !== null ? `${stats.max.toFixed(2)} ppm` : '—'}</span>
        </div>
      )}
      {tags.length > 3 && (
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <IonSearchbar
            value={search}
            placeholder="SEARCH TAGS..."
            onIonInput={(e) => setSearch(e.detail.value!)}
            style={{ padding: '0 0 8px 0', width: '100%' }}
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 16px', color: '#64748B' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>No inspection tags found</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Tap "+ Add Tag" to capture the first reading</p>
        </div>
      ) : (
        filtered.map((tag) => (
          <TagCard
            key={tag.id}
            tag={tag}
            onClick={onSelectTag ? () => onSelectTag(tag) : tag.isOffline && onEditTag ? () => onEditTag(tag) : undefined}
            onEdit={onEditTag}
            onDelete={onDeleteTag}
          />
        ))
      )}
    </div>
  );
};
export default TagList;
