import React, { useState, useMemo } from 'react';
import { IonSearchbar } from '@ionic/react';
import { InspectionTag } from '../../types/inspection';
import TagCard from './TagCard';

interface Props {
  tags: InspectionTag[];
  onSelectTag?: (tag: InspectionTag) => void;
}

export const TagList: React.FC<Props> = ({ tags, onSelectTag }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.toUpperCase();
    return tags.filter((t) => t.tag_name.includes(q) || t.status.includes(q));
  }, [tags, search]);

  const stats = useMemo(() => {
    if (tags.length === 0) return { max: 0, avg: 0 };
    const max = Math.max(...tags.map((t) => t.ammonia));
    const avg = tags.reduce((acc, t) => acc + t.ammonia, 0) / tags.length;
    return { max, avg };
  }, [tags]);

  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', padding: '10px 14px', background: '#F8FAFC', borderRadius: '10px', fontSize: '13px' }}>
          <span><strong>Total:</strong> {tags.length}</span>
          <span>•</span>
          <span><strong>Avg NH3:</strong> {stats.avg.toFixed(2)} PPM</span>
          <span>•</span>
          <span><strong>Max:</strong> {stats.max.toFixed(2)} PPM</span>
        </div>
      )}
      {tags.length > 3 && (
        <IonSearchbar
          value={search}
          placeholder="SEARCH TAGS..."
          onIonInput={(e) => setSearch(e.detail.value!)}
          style={{ padding: '0 0 8px 0' }}
        />
      )}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 16px', color: '#64748B' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>No inspection tags found</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Tap "+ Add Tag" to capture the first reading</p>
        </div>
      ) : (
        filtered.map((tag) => (
          <TagCard key={tag.id} tag={tag} onClick={() => onSelectTag?.(tag)} />
        ))
      )}
    </div>
  );
};
export default TagList;
