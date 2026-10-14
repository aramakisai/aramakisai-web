'use client';

import {
  Button,
  CheckboxInput,
  FieldLabel,
  TextInput,
  useAuth,
  useDocumentDrawer,
  useDocumentInfo,
  useField,
} from '@payloadcms/ui';
import type { RelationshipFieldClientComponent } from 'payload';

import { useEffect, useState, type ChangeEvent } from 'react';

import { addMemberToGroup } from './signage-groups';
import {
  fetchAllMembers,
  movableIds,
  moveValue,
  selectAllIds,
  split,
  withoutMoved,
  type Queries,
  type MemberRow,
} from './signage-group-members';

const BORDER = '1px solid var(--theme-elevation-150)';

const SAVE_FAILED = '所属を保存できませんでした。グループを保存してください';

type MembersFieldProps = {
  collection: 'signage_slides' | 'telops';
  titleField: 'title' | 'body';
  groupField: 'slides' | 'telops';
};

const NOUN = { signage_slides: 'スライド', telops: 'テロップ' } as const;

const SignageGroupMembersField: RelationshipFieldClientComponent = (props) => {
  const { path, field, readOnly } = props;
  const { collection, titleField, groupField } = props as typeof props & MembersFieldProps;
  const noun = NOUN[collection];
  const { value, setValue } = useField<number[]>({ path });
  const { id: groupId } = useDocumentInfo();
  const { permissions } = useAuth();
  const [all, setAll] = useState<MemberRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [queries, setQueries] = useState<Queries>({ left: '', right: '' });
  const [leftSel, setLeftSel] = useState<Set<number>>(new Set());
  const [rightSel, setRightSel] = useState<Set<number>>(new Set());
  const [createError, setCreateError] = useState(false);
  const [DocumentDrawer, , { openDrawer, closeDrawer }] = useDocumentDrawer({ collectionSlug: collection });

  useEffect(() => {
    let alive = true;
    fetchAllMembers(collection, titleField)
      .then((rows) => alive && setAll(rows))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [collection, titleField]);

  const label = <FieldLabel label={field.label} path={path} />;
  if (failed) {
    // 値は変えないため、保存しても所属は消えない
    return (
      <div className="field-type">
        {label}
        <p>{noun}を読み込めませんでした</p>
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
  const { unregistered, registered, unregisteredTotal, registeredTotal } = split(all, current, queries);
  const locked = Boolean(readOnly);
  const canCreate = !locked && Boolean(permissions?.collections?.[collection]?.create);
  const left = movableIds(leftSel, unregistered);
  const right = movableIds(rightSel, registered);

  const move = (ids: number[], direction: 'add' | 'remove') => {
    setValue(moveValue(all, current, ids, direction));
    if (direction === 'add') setLeftSel((s) => withoutMoved(s, ids));
    else setRightSel((s) => withoutMoved(s, ids));
  };

  const onCreated = async ({ doc, operation }: { doc: unknown; operation?: string }) => {
    if (operation !== 'create') return;
    const d = doc as { id: number; enabled?: boolean | null } & Record<string, unknown>;
    const created: MemberRow = { id: d.id, title: String(d[titleField] ?? ''), enabled: Boolean(d.enabled) };
    setAll([...all, created]);
    // PATCH で保存済みのため、フォームを未保存扱いにしない(既に未保存なら、その状態はそのまま残る)
    setValue(moveValue([...all, created], current, [created.id], 'add'), true);
    closeDrawer();
    setCreateError(false);
    // 標準の関連項目と違い、保存ボタンを待たずに所属を保存して、グループの保存忘れで孤立するのを防ぐ
    if (groupId) await addMemberToGroup(Number(groupId), groupField, created.id).catch(() => setCreateError(true));
  };

  const column = (
    side: keyof Queries,
    title: string,
    visible: MemberRow[],
    total: number,
    selected: Set<number>,
    setSelected: (s: Set<number>) => void,
  ) => {
    return (
      <div style={{ flex: 1, minWidth: 0, border: BORDER, borderRadius: 'var(--style-radius-s)', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--base)',
            padding: 'calc(var(--base) / 2) var(--base)',
            background: 'var(--theme-elevation-50)',
            borderBottom: BORDER,
          }}
        >
          <CheckboxInput
            label="全選択"
            readOnly={locked}
            checked={visible.length > 0 && visible.every((r) => selected.has(r.id))}
            onToggle={(e) => setSelected(e.target.checked ? new Set(selectAllIds(visible)) : new Set())}
          />
          <strong style={{ flex: 1 }}>
            {title} ({total})
          </strong>
          {canCreate && (
            <Button buttonStyle="secondary" size="small" margin={false} disabled={!groupId} onClick={openDrawer}>
              {noun}を新規作成
            </Button>
          )}
        </div>
        <div style={{ padding: 'calc(var(--base) / 2) var(--base)', borderBottom: BORDER }}>
          <TextInput
            path={`${path}-filter-${side}`}
            placeholder={titleField === 'title' ? '題名で絞り込む' : '文面で絞り込む'}
            value={queries[side]}
            readOnly={locked}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQueries((q) => ({ ...q, [side]: e.target.value }))}
          />
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 400, overflowY: 'auto' }}>
          {visible.length === 0 && (
            <li style={{ padding: 'calc(var(--base) / 2) var(--base)', color: 'var(--theme-elevation-500)' }}>
              {noun}はありません
            </li>
          )}
          {visible.map((r) => (
            <li key={r.id} style={{ borderBottom: BORDER, minHeight: 'calc(var(--base) * 2)' }}>
              <label
                htmlFor={`${path}-${side}-${r.id}`}
                style={{ display: 'block', padding: 'calc(var(--base) / 2) var(--base)', cursor: locked ? 'default' : 'pointer' }}
              >
                <CheckboxInput
                  id={`${path}-${side}-${r.id}`}
                  Label={
                    <span style={{ marginLeft: 'calc(var(--base) / 2)' }}>
                      {r.title}
                      {!r.enabled && <span style={{ marginLeft: 8, color: 'var(--theme-elevation-500)' }}>無効</span>}
                    </span>
                  }
                  readOnly={locked}
                  checked={selected.has(r.id)}
                  onToggle={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    setSelected(next);
                  }}
                />
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
      {canCreate && !groupId && (
        <p style={{ color: 'var(--theme-elevation-500)' }}>グループを保存すると、ここから{noun}を作成できます</p>
      )}
      <div style={{ display: 'flex', gap: 'var(--base)', alignItems: 'stretch', marginTop: 'var(--base)' }}>
        {column('left', '未登録', unregistered, unregisteredTotal, leftSel, setLeftSel)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--base) / 2)', justifyContent: 'center' }}>
          <Button
            buttonStyle="secondary"
            size="small"
            margin={false}
            disabled={locked || left.length === 0}
            onClick={() => move(left, 'add')}
          >
            追加 →
          </Button>
          <Button
            buttonStyle="secondary"
            size="small"
            margin={false}
            disabled={locked || right.length === 0}
            onClick={() => move(right, 'remove')}
          >
            ← 外す
          </Button>
        </div>
        {column('right', '登録済み', registered, registeredTotal, rightSel, setRightSel)}
      </div>
      {createError && <p style={{ color: 'var(--theme-error-500)' }}>{SAVE_FAILED}</p>}
      <DocumentDrawer initialData={{ enabled: false }} onSave={onCreated} />
    </div>
  );
};

export default SignageGroupMembersField;
