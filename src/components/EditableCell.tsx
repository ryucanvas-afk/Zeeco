import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'select' | 'progress' | 'multiline';
  options?: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
}

export default function EditableCell({
  value,
  onSave,
  type = 'text',
  options,
  className = '',
  placeholder = '-',
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement && type === 'text') {
        inputRef.current.select();
      }
      if (inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.selectionStart = inputRef.current.value.length;
      }
    }
  }, [editing, type]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (type === 'multiline') {
      if (e.key === 'Enter' && e.shiftKey) {
        // Allow newline
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commit();
        return;
      }
    } else if (e.key === 'Enter') {
      commit();
    }
    if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  };

  if (type === 'select' && options) {
    if (editing) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          className="editable-select-input"
          value={draft}
          onChange={e => { setDraft(e.target.value); }}
          onBlur={() => { commit(); }}
          onKeyDown={handleKeyDown}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    const label = options.find(o => o.value === value)?.label || value;
    return (
      <span className={`editable-cell ${className}`} onClick={() => setEditing(true)} title="클릭하여 수정">
        {label || placeholder}
      </span>
    );
  }

  if (type === 'progress') {
    if (editing) {
      return (
        <div className="editable-progress-input">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="range"
            min="0"
            max="100"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onMouseUp={commit}
          />
          <span>{draft}%</span>
        </div>
      );
    }
    return (
      <span className={`editable-cell ${className}`} onClick={() => setEditing(true)} title="클릭하여 수정">
        {value || '0'}%
      </span>
    );
  }

  if (type === 'multiline') {
    if (editing) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className="editable-textarea-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          rows={Math.max(2, draft.split('\n').length)}
          placeholder={placeholder}
        />
      );
    }
    const displayValue = value || placeholder;
    const hasMultiLine = value && value.includes('\n');
    return (
      <span
        className={`editable-cell ${className} ${!value ? 'editable-cell-empty' : ''} ${hasMultiLine ? 'editable-cell-multiline' : ''}`}
        onClick={() => setEditing(true)}
        title="클릭하여 수정 (Shift+Enter로 줄바꿈)"
      >
        {hasMultiLine ? value.split('\n').map((line, i) => (
          <span key={i}>{line}{i < value.split('\n').length - 1 && <br />}</span>
        )) : displayValue}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        className="editable-text-input"
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        step={type === 'number' ? 'any' : undefined}
      />
    );
  }

  const displayValue = type === 'number' && value
    ? Number(value).toLocaleString()
    : (value || placeholder);

  return (
    <span
      className={`editable-cell ${className} ${!value ? 'editable-cell-empty' : ''}`}
      onClick={() => setEditing(true)}
      title="클릭하여 수정"
    >
      {displayValue}
    </span>
  );
}
