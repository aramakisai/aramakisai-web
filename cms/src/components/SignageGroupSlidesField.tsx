'use client';

import { FieldLabel, useAuth, useDocumentDrawer, useDocumentInfo, useField } from '@payloadcms/ui';
import type { RelationshipFieldClientComponent } from 'payload';
import { useEffect, useState } from 'react';

import { addSlideToGroup } from './signage-groups';
import {
  fetchAllSlides,
  filterRows,
  movableIds,
  moveValue,
  selectAllIds,
  split,
  withoutMoved,
  type SlideRow,
} from './signage-group-slides';

const SAVE_FAILED = '所属を保存できませんでした。グループを保存してください';

const SignageGroupSlidesField: RelationshipFieldClientComponent = ({ path, field, readOnly }) => {
  const { value, setValue } = useField<number[]>({ path });
  const { id: groupId } = useDocumentInfo();
  const { permissions } = useAuth();
  const [all, setAll] = useState<SlideRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [leftSel, setLeftSel] = useState<Set<number>>(new Set());
  const [rightSel, setRightSel] = useState<Set<number>>(new Set());
  const [createError, setCreateError] = useState(false);
  const [DocumentDrawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({ collectionSlug: 'signage_slides' });

  useEffect(() => {
    let alive = true;
    fetchAllSlides()
      .then((rows) => alive && setAll(rows))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const label = <FieldLabel label={field.label} path={path} />;
  if (failed) {
    // 値は変えないため、保存しても所属は消えない
    return (
      <div className="field-type">
        {label}
        <p>スライドを読み込めませんでした</p>
      </div>
    );
  }
  if (!all) {
    return (
      <div className="field-type">
        {label}
        <p>読み込み中</p>
      </div>
    );
  }

  const current = value ?? [];
  const { unregistered, registered } = split(all, current);
  const locked = Boolean(readOnly);
  const canCreate = !locked && Boolean(permissions?.collections?.signage_slides?.create);
  const left = movableIds(leftSel, unregistered, query);
  const right = movableIds(rightSel, registered, query);

  const move = (ids: number[], direction: 'add' | 'remove') => {
    setValue(moveValue(all, current, ids, direction));
    if (direction === 'add') setLeftSel((s) => withoutMoved(s, ids));
    else setRightSel((s) => withoutMoved(s, ids));
  };

  const onCreated = async ({ doc, operation }: { doc: unknown; operation?: string }) => {
    if (operation !== 'create') return;
    const d = doc as { id: number; title: string; enabled?: boolean | null };
    const created: SlideRow = { id: d.id, title: d.title, enabled: Boolean(d.enabled) };
    setAll([...all, created]);
    // PATCH で保存済みのため、フォームを未保存扱いにしない(既に未保存なら、その状態はそのまま残る)
    setValue(moveValue([...all, created], current, [created.id], 'add'), true);
    closeDrawer();
    setCreateError(false);
    // 標準の関連項目と違い、保存ボタンを待たずに所属を保存して、グループの保存忘れで孤立するのを防ぐ
    if (groupId) await addSlideToGroup(Number(groupId), created.id).catch(() => setCreateError(true));
  };

  const column = (
    title: string,
    rows: SlideRow[],
    selected: Set<number>,
    setSelected: (s: Set<number>) => void,
    allowCreate: boolean,
  ) => {
    const visible = filterRows(rows, query);
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>
            {title} ({rows.length})
          </strong>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              disabled={locked}
              checked={visible.length > 0 && visible.every((r) => selected.has(r.id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(selectAllIds(rows, query)) : new Set())}
            />
            全選択
          </label>
        </div>
        {allowCreate && canCreate && (
          <div>
            <button
              type="button"
              className="btn btn--style-secondary btn--size-small"
              disabled={!groupId}
              onClick={openDrawer}
            >
              スライドを新規作成
            </button>
            {!groupId && <p>グループを保存すると、ここからスライドを作成できます</p>}
          </div>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {visible.map((r) => (
            <li key={r.id}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={selected.has(r.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    setSelected(next);
                  }}
                />
                {r.title}
                {!r.enabled && <span style={{ color: 'var(--theme-elevation-500)' }}>無効</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="field-type">
      {label}
      <input
        type="search"
        aria-label="題名で絞り込む"
        placeholder="題名で絞り込む"
        value={query}
        disabled={locked}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 'var(--base)', alignItems: 'flex-start', marginTop: 'var(--base)' }}>
        {column('未登録', unregistered, leftSel, setLeftSel, true)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="btn btn--style-secondary btn--size-small"
            disabled={locked || left.length === 0}
            onClick={() => move(left, 'add')}
          >
            追加 →
          </button>
          <button
            type="button"
            className="btn btn--style-secondary btn--size-small"
            disabled={locked || right.length === 0}
            onClick={() => move(right, 'remove')}
          >
            ← 外す
          </button>
        </div>
        {column('登録済み', registered, rightSel, setRightSel, true)}
      </div>
      {createError && <p style={{ color: 'var(--theme-error-500)' }}>{SAVE_FAILED}</p>}
      <DocumentDrawer initialData={{ enabled: false }} onSave={onCreated} />
    </div>
  );
};

export default SignageGroupSlidesField;
