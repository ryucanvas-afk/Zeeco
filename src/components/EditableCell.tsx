import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'select' | 'progress';
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
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement && type === 'text') {
        inputRef.current.select();
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
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
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

  const displayValue = value || placeholder;

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
